import { Job } from '@executions/domain/entities/job.entity';
import { JobKind } from '@executions/domain/entities/job.props';
import {
  JobUsage,
  UsageLimits,
  parseJobUsage,
  parseLimits,
} from '@executions/domain/usage';
import { UsageService } from './usage.service';
import { InMemoryJobs, InMemoryUsageSnapshots } from './testing/fakes';

const NOW = new Date('2026-10-26T12:00:00Z');
const RESETS_5H = '2026-10-26T14:00:00.000Z';
const RESETS_WEEK = '2026-11-01T17:00:00.000Z';

const limits = (
  fiveHour: number,
  week = 0.03,
  reset5h = RESETS_5H,
): UsageLimits => ({
  fiveHour: { used: fiveHour, resetsAt: reset5h },
  sevenDay: { used: week, resetsAt: RESETS_WEEK },
});

const tokens = (input: number, output = 0, cacheWrite = 0, cacheRead = 0) => ({
  input,
  output,
  cacheWrite,
  cacheRead,
});

/** Un trabajo ya terminado, con lo que gastó y cómo iba el plan cuando corrió. */
function job(
  executionId: string,
  kind: JobKind,
  data: {
    start: string;
    end: string;
    cost: number;
    usage?: JobUsage | null;
    agent?: { id: string; name: string };
  },
): Job {
  const result = Job.create({
    executionId,
    kind,
    payload: {
      agent: null,
      prompt: '',
      repo: { sshUrl: 'x', fullName: 'a/b' },
      branch: 'b',
    },
  });
  const props = result.toProps();
  props.status = 'done';
  props.startedAt = new Date(data.start);
  props.finishedAt = new Date(data.end);
  props.costUsd = data.cost;
  props.usage = data.usage ?? null;
  if (data.agent) {
    props.payload = {
      ...props.payload,
      agent: { ...data.agent, model: 'm', systemPrompt: 'x', allowedTools: [] },
    };
  }
  return result;
}

describe('UsageService', () => {
  let snapshots: InMemoryUsageSnapshots;
  let jobs: InMemoryJobs;
  let service: UsageService;

  beforeEach(() => {
    snapshots = new InMemoryUsageSnapshots();
    jobs = new InMemoryJobs();
    service = new UsageService(snapshots, jobs);
  });

  const snapshot = (at: string, value: UsageLimits) =>
    service.record(value, 'probe', null, new Date(at));

  describe('recording how the plan is going', () => {
    it('keeps each measure, and does nothing when the job brought none', async () => {
      await service.record(null, 'job');
      await service.record(limits(0.24), 'job', 'job-1');

      expect(snapshots.items).toHaveLength(1);
      expect(snapshots.items[0]).toMatchObject({
        source: 'job',
        jobId: 'job-1',
      });
    });

    it('checks what comes from the runner: nonsense is not stored', () => {
      expect(
        parseLimits({ fiveHour: { used: 'mucho', resetsAt: 'ayer' } }),
      ).toBeNull();
      expect(parseLimits('hola')).toBeNull();
      expect(
        parseJobUsage({ tokens: { input: -5, output: 'x' }, limits: null }),
      ).toEqual({
        tokens: tokens(0),
        limits: null,
      });
    });
  });

  describe('what an execution spent', () => {
    const run = (
      id: string,
      start: string,
      end: string,
      before: number,
      cost = 0.5,
    ) => [
      job(id, 'tickets', {
        start,
        end,
        cost,
        usage: { tokens: tokens(100, 50, 1000, 2000), limits: limits(before) },
      }),
      job(id, 'develop', {
        start,
        end,
        cost,
        usage: {
          tokens: tokens(10, 5, 100, 200),
          limits: limits(before + 0.01),
        },
      }),
    ];

    it('adds up the exact tokens and the cost of its jobs', async () => {
      const usage = await service.ofExecution(
        run('e1', '2026-10-26T10:00:00Z', '2026-10-26T10:05:00Z', 0.24),
      );

      expect(usage.tokens).toEqual({
        ...tokens(110, 55, 1100, 2200),
        total: 3465,
      });
      expect(usage.costUsd).toBe(1);
    });

    it('measures how much the window rose while it ran, from its first job to the next measure', async () => {
      const executionJobs = run(
        'e1',
        '2026-10-26T10:00:00Z',
        '2026-10-26T10:05:00Z',
        0.24,
      );
      await snapshot('2026-10-26T10:06:00Z', limits(0.31, 0.04));

      const usage = await service.ofExecution(executionJobs);

      expect(usage.measured.fiveHour?.delta).toBeCloseTo(0.07);
      expect(usage.measured.fiveHour).toMatchObject({ from: 0.24, to: 0.31 });
      expect(usage.measured.sevenDay?.delta).toBeCloseTo(0.01);
    });

    it('does not measure when the window restarted in between', async () => {
      const executionJobs = run(
        'e1',
        '2026-10-26T10:00:00Z',
        '2026-10-26T10:05:00Z',
        0.9,
      );
      await snapshot(
        '2026-10-26T10:06:00Z',
        limits(0.05, 0.04, '2026-10-26T19:00:00.000Z'),
      );

      expect(
        (await service.ofExecution(executionJobs)).measured.fiveHour,
      ).toBeNull();
    });

    it('does not measure when the next measure came too long after, because it would carry other use', async () => {
      const executionJobs = run(
        'e1',
        '2026-10-26T10:00:00Z',
        '2026-10-26T10:05:00Z',
        0.24,
      );
      await snapshot('2026-10-26T11:30:00Z', limits(0.4));

      expect(
        (await service.ofExecution(executionJobs)).measured.fiveHour,
      ).toBeNull();
    });

    it('does not measure while a job is still running, and keeps the exact tokens', async () => {
      const executionJobs = run(
        'e1',
        '2026-10-26T10:00:00Z',
        '2026-10-26T10:05:00Z',
        0.24,
      );
      executionJobs[1].toProps().status = 'running';
      await snapshot('2026-10-26T10:06:00Z', limits(0.31));

      const usage = await service.ofExecution(executionJobs);

      expect(usage.measured.fiveHour).toBeNull();
      expect(usage.tokens.total).toBe(3465);
    });

    it('says nothing measured for the executions from before the plan was measured', async () => {
      const old = [
        job('e0', 'develop', {
          start: '2026-10-20T10:00:00Z',
          end: '2026-10-20T10:05:00Z',
          cost: 0.2,
        }),
      ];

      const usage = await service.ofExecution(old);

      expect(usage.tokens.total).toBe(0);
      expect(usage.costUsd).toBe(0.2);
      expect(usage.measured).toEqual({ fiveHour: null, sevenDay: null });
    });
  });

  describe('the calibration (how much 1 point of the window costs)', () => {
    /** Una ejecución terminada que subió la ventana `points` puntos y costó `cost`. */
    async function measured(
      id: string,
      hour: number,
      cost: number,
      points: number,
    ) {
      const start = `2026-10-26T0${hour}:00:00Z`;
      const end = `2026-10-26T0${hour}:05:00Z`;
      jobs.items.push(
        job(id, 'develop', {
          start,
          end,
          cost,
          usage: { tokens: tokens(1000), limits: limits(0.1) },
        }),
      );
      await snapshot(`2026-10-26T0${hour}:06:00Z`, limits(0.1 + points / 100));
    }

    it('needs at least two measured executions to be believed', async () => {
      await measured('e1', 1, 1, 5);

      expect((await service.calibration(NOW.getTime())).fiveHour).toEqual({
        costPerPoint: null,
        samples: 1,
      });
    });

    it('takes the median of what each point cost, so a contaminated measure does not ruin it', async () => {
      await measured('e1', 1, 1, 5); // 0,20 por punto
      await measured('e2', 2, 1, 10); // 0,10 por punto
      await measured('e3', 3, 1, 50); // 0,02 por punto: se usó la cuenta en otra sesión

      const calibration = await service.calibration(NOW.getTime());

      expect(calibration.fiveHour.samples).toBe(3);
      expect(calibration.fiveHour.costPerPoint).toBeCloseTo(0.1);
    });

    it('turns the cost of an execution into an estimated share of the window', async () => {
      await measured('e1', 1, 1, 5);
      await measured('e2', 2, 1, 10);
      const executionJobs = [
        job('e9', 'develop', {
          start: '2026-10-26T08:00:00Z',
          end: '2026-10-26T08:05:00Z',
          cost: 0.6,
          usage: { tokens: tokens(1), limits: limits(0.1) },
        }),
      ];

      const usage = await service.ofExecution(
        executionJobs,
        await service.calibration(NOW.getTime()),
      );

      // La mediana de 0,20 y 0,10 es 0,15 por punto: 0,6 son unos 4 puntos.
      expect(usage.estimatedPoints.fiveHour).toBeCloseTo(4);
    });

    it('gives no estimate while there is nothing to calibrate with', async () => {
      const usage = await service.ofExecution([
        job('e9', 'develop', {
          start: '2026-10-26T08:00:00Z',
          end: '2026-10-26T08:05:00Z',
          cost: 0.6,
        }),
      ]);

      expect(usage.estimatedPoints).toEqual({ fiveHour: null, sevenDay: null });
    });
  });

  describe('the consumption screen', () => {
    it('shows how the plan goes now, with how old that measure is', async () => {
      await snapshot('2026-10-26T11:50:00Z', limits(0.25, 0.04));

      const overview = await service.overview('America/Santiago', 7, NOW);

      expect(overview.current.fiveHour?.used).toBe(0.25);
      expect(overview.current.sevenDay?.used).toBe(0.04);
      expect(overview.current.ageSeconds).toBe(600);
    });

    it('has no measure to show before the first one', async () => {
      const overview = await service.overview('America/Santiago', 7, NOW);

      expect(overview.current).toEqual({
        fiveHour: null,
        sevenDay: null,
        takenAt: null,
        ageSeconds: null,
      });
    });

    it('spends by day in the time zone of whoever looks, and shows the empty days too', async () => {
      // 02:30 UTC del 26 es todavía el 25 en Chile (UTC−3); 12:00 UTC del 26 ya es el 26.
      jobs.items.push(
        job('e1', 'develop', {
          start: '2026-10-26T02:20:00Z',
          end: '2026-10-26T02:30:00Z',
          cost: 0.4,
          usage: { tokens: tokens(1000), limits: null },
        }),
        job('e2', 'review', {
          start: '2026-10-26T11:50:00Z',
          end: '2026-10-26T12:00:00Z',
          cost: 0.1,
          usage: { tokens: tokens(200, 50), limits: null },
        }),
      );

      const overview = await service.overview('America/Santiago', 3, NOW);

      expect(overview.days.map((day) => day.date)).toEqual([
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
      ]);
      expect(overview.days.map((day) => day.tokens)).toEqual([0, 1000, 250]);
      expect(overview.days[1].byKind).toEqual({ develop: 1000 });
      expect(overview.today.tokens).toBe(250);
      expect(overview.week.tokens).toBe(1250);
    });

    it('puts the spending in points of the week when it can estimate them', async () => {
      // Dos ejecuciones que subieron la semana: 1 punto por 0,5 y 2 puntos por 0,5 → mediana 0,375 por punto.
      const week = (id: string, hour: number, cost: number, points: number) => {
        jobs.items.push(
          job(id, 'develop', {
            start: `2026-10-26T0${hour}:00:00Z`,
            end: `2026-10-26T0${hour}:05:00Z`,
            cost,
            usage: { tokens: tokens(1), limits: limits(0.1, 0.1) },
          }),
        );
        return service.record(
          limits(0.1, 0.1 + points / 100),
          'probe',
          null,
          new Date(`2026-10-26T0${hour}:06:00Z`),
        );
      };
      await week('e1', 1, 0.5, 1);
      await week('e2', 2, 0.5, 2);

      const overview = await service.overview('UTC', 1, NOW);

      expect(overview.calibration.sevenDay.costPerPoint).toBeCloseTo(0.375);
      expect(overview.today.costUsd).toBeCloseTo(1);
      expect(overview.today.estimatedPoints).toBeCloseTo(1 / 0.375);
    });

    it('spends by agent, from the one that spent most, with the jobs that have no agent together', async () => {
      const done = (
        id: string,
        kind: 'develop' | 'review' | 'publish',
        cost: number,
        input: number,
        agent?: { id: string; name: string },
      ) =>
        job(id, kind, {
          start: '2026-10-26T11:00:00Z',
          end: '2026-10-26T11:30:00Z',
          cost,
          usage: { tokens: tokens(input), limits: null },
          agent,
        });
      const david = { id: 'ag-david', name: 'default-task-developer' };
      const maine = { id: 'ag-maine', name: 'default-task-reviewer' };
      jobs.items.push(
        done('e1', 'develop', 0.5, 1000, david),
        done('e1', 'review', 0.1, 300, maine),
        done('e2', 'develop', 0.4, 800, david),
        done('e2', 'publish', 0.01, 50),
      );

      const overview = await service.overview('UTC', 1, NOW);

      expect(
        overview.byAgent.map((a) => [a.agentId, a.agentName, a.jobs, a.tokens]),
      ).toEqual([
        ['ag-david', 'default-task-developer', 2, 1800],
        ['ag-maine', 'default-task-reviewer', 1, 300],
        [null, null, 1, 50],
      ]);
      expect(overview.byAgent[0].costUsd).toBeCloseTo(0.9);
      expect(overview.byAgent.every((a) => a.estimatedPoints === null)).toBe(
        true,
      );
    });

    it('leaves out of the agents what is outside the period, and the jobs that were not measured', async () => {
      jobs.items.push(
        job('e1', 'develop', {
          start: '2026-10-10T10:00:00Z',
          end: '2026-10-10T10:30:00Z',
          cost: 1,
          usage: { tokens: tokens(5000), limits: null },
          agent: { id: 'ag-david', name: 'd' },
        }),
        job('e2', 'develop', {
          start: '2026-10-26T10:00:00Z',
          end: '2026-10-26T10:30:00Z',
          cost: 1,
          agent: { id: 'ag-david', name: 'd' },
        }),
      );

      expect((await service.overview('UTC', 7, NOW)).byAgent).toEqual([]);
    });

    it('puts the spending of each agent in points of the week when it can estimate them', async () => {
      const week = (
        id: string,
        hour: number,
        cost: number,
        points: number,
        agent: { id: string; name: string },
      ) => {
        jobs.items.push(
          job(id, 'develop', {
            start: `2026-10-26T0${hour}:00:00Z`,
            end: `2026-10-26T0${hour}:05:00Z`,
            cost,
            usage: { tokens: tokens(1), limits: limits(0.1, 0.1) },
            agent,
          }),
        );
        return service.record(
          limits(0.1, 0.1 + points / 100),
          'probe',
          null,
          new Date(`2026-10-26T0${hour}:06:00Z`),
        );
      };
      await week('e1', 1, 0.5, 1, { id: 'ag-a', name: 'a' });
      await week('e2', 2, 0.5, 2, { id: 'ag-b', name: 'b' });

      const overview = await service.overview('UTC', 1, NOW);

      // La mediana de 0,50 y 0,25 por punto es 0,375.
      expect(overview.byAgent[0].estimatedPoints).toBeCloseTo(0.5 / 0.375);
    });

    it('falls back to UTC when the time zone is unknown', async () => {
      const overview = await service.overview('Mars/Olympus', 1, NOW);

      expect(overview.days.map((day) => day.date)).toEqual(['2026-10-26']);
    });
  });

  describe('asking for a new measure', () => {
    it('hands the request to the runner once, and says it is refreshing until a newer measure arrives', async () => {
      await snapshot('2026-10-26T11:00:00Z', limits(0.2));
      service.requestRefresh(NOW.getTime());

      expect((await service.overview('UTC', 1, NOW)).refreshing).toBe(true);
      expect(service.takeRefreshRequest()).toBe(true);
      expect(service.takeRefreshRequest()).toBe(false);
      expect((await service.overview('UTC', 1, NOW)).refreshing).toBe(true);

      await snapshot('2026-10-26T12:00:10Z', limits(0.21));

      expect(
        (await service.overview('UTC', 1, new Date('2026-10-26T12:00:20Z')))
          .refreshing,
      ).toBe(false);
    });

    it('stops saying it is refreshing when the runner never answered', async () => {
      service.requestRefresh(NOW.getTime());

      const later = new Date(NOW.getTime() + 120_000);

      expect((await service.overview('UTC', 1, later)).refreshing).toBe(false);
    });
  });
});
