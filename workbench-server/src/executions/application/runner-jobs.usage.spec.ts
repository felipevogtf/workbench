import { Job } from '@executions/domain/entities/job.entity';
import { Runner } from '@executions/domain/entities/runner.entity';
import { ExecutionsService } from './executions.service';
import { RunnerJobsService } from './runner-jobs.service';
import { RunnersService } from './runners.service';
import { UsageService } from './usage.service';
import {
  InMemoryJobs,
  InMemoryRunners,
  InMemoryUsageSnapshots,
} from './testing/fakes';

describe('RunnerJobsService: what a job spent', () => {
  let jobs: InMemoryJobs;
  let snapshots: InMemoryUsageSnapshots;
  let runner: Runner;
  let service: RunnerJobsService;

  beforeEach(async () => {
    jobs = new InMemoryJobs();
    snapshots = new InMemoryUsageSnapshots();
    const runners = new InMemoryRunners();
    runner = await runners.save(Runner.create({ name: 'pc', tokenHash: 'x' }));
    service = new RunnerJobsService(
      jobs,
      runners,
      new RunnersService(runners),
      {
        handleFinished: () => Promise.resolve(),
      } as unknown as ExecutionsService,
      new UsageService(snapshots, jobs),
    );
    await jobs.save(
      Job.create({
        executionId: 'e1',
        kind: 'develop',
        payload: {
          agent: null,
          prompt: '',
          repo: { sshUrl: 'x', fullName: 'a/b' },
          branch: 'b',
        },
      }),
    );
  });

  const usage = {
    tokens: { input: 100, output: 50, cacheWrite: 1000, cacheRead: 2000 },
    limits: {
      fiveHour: { used: 0.24, resetsAt: '2026-10-26T14:00:00.000Z' },
      sevenDay: { used: 0.03, resetsAt: '2026-11-01T17:00:00.000Z' },
    },
  };

  it('keeps the tokens of the job and the state of the plan while it ran, as one more measure', async () => {
    const job = (await service.claim(runner, 0))!;

    await service.finish(runner, job.id, {
      ok: true,
      result: {},
      costUsd: 0.2,
      usage,
    });

    expect(job.usage).toEqual(usage);
    expect(snapshots.items).toHaveLength(1);
    expect(snapshots.items[0]).toMatchObject({ source: 'job', jobId: job.id });
    expect(snapshots.items[0].limits.fiveHour?.used).toBe(0.24);
  });

  it('keeps it also when the job failed: it spent tokens anyway', async () => {
    const job = (await service.claim(runner, 0))!;

    await service.finish(runner, job.id, {
      ok: false,
      error: 'falló',
      costUsd: 0.1,
      usage,
    });

    expect(job.status).toBe('failed');
    expect(job.usage?.tokens.output).toBe(50);
  });

  it('does not break when the runner brings no usage (an older runner)', async () => {
    const job = (await service.claim(runner, 0))!;

    await service.finish(runner, job.id, {
      ok: true,
      result: {},
      costUsd: 0.2,
    });

    expect(job.status).toBe('done');
    expect(job.usage).toBeNull();
    expect(snapshots.items).toHaveLength(0);
  });
});
