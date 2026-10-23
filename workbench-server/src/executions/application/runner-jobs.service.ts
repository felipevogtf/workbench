import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from '@executions/domain/entities/job.entity';
import { JobResult } from '@executions/domain/entities/job.props';
import { Runner } from '@executions/domain/entities/runner.entity';
import {
  JOB_REPOSITORY_PORT,
  type JobRepositoryPort,
} from '@executions/domain/ports/job-repository.port';
import {
  RUNNER_REPOSITORY_PORT,
  type RunnerRepositoryPort,
} from '@executions/domain/ports/runner-repository.port';
import { ExecutionsService } from './executions.service';
import { RunnersService } from './runners.service';

/** Cuánto espera un runner por trabajo antes de que la petición responda «nada por ahora». */
export const CLAIM_WAIT_MS = 25_000;
const CLAIM_POLL_MS = 1_000;
/** Un trabajo cuyo runner lleva más de esto sin dar señales se da por perdido. */
export const STALE_JOB_MS = 2 * 60_000;

export interface JobOutcome {
  ok: boolean;
  result?: JobResult;
  error?: string;
  costUsd?: number | null;
}

/** Lo que el runner hace con el servidor: pedir trabajo, informar y entregar resultados. */
@Injectable()
export class RunnerJobsService {
  private readonly logger = new Logger(RunnerJobsService.name);

  constructor(
    @Inject(JOB_REPOSITORY_PORT) private readonly jobs: JobRepositoryPort,
    @Inject(RUNNER_REPOSITORY_PORT)
    private readonly runners: RunnerRepositoryPort,
    private readonly runnersService: RunnersService,
    private readonly executions: ExecutionsService,
  ) {}

  /**
   * Espera hasta `waitMs` por un trabajo y se lo asigna al runner. Quien llama debe estar libre: un
   * runner con un trabajo en curso no pide otro.
   */
  async claim(runner: Runner, waitMs = CLAIM_WAIT_MS): Promise<Job | null> {
    const deadline = Date.now() + waitMs;

    for (;;) {
      // Un runner revocado en pleno sondeo no recibe más trabajo (y su petición termina).
      if (!(await this.runnersService.touch(runner))) return null;
      const job = await this.jobs.claimNext(runner.id);
      if (job) return job;
      if (Date.now() + CLAIM_POLL_MS >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, CLAIM_POLL_MS));
    }
  }

  /**
   * El runner avisa que sigue vivo y qué trabajos tiene en curso. La respuesta dice cuáles debe
   * detener: los que se cancelaron o ya no existen.
   */
  async heartbeat(runner: Runner, runningJobIds: string[]): Promise<string[]> {
    // Un runner revocado debe detener todo lo que esté haciendo.
    if (!(await this.runnersService.touch(runner))) return [...runningJobIds];

    const stop: string[] = [];
    for (const id of runningJobIds) {
      const job = await this.jobs.findById(id);
      if (!job || job.status !== 'running' || job.runnerId !== runner.id) {
        stop.push(id);
      }
    }
    return stop;
  }

  /** Agrega salida al registro de un trabajo. Devuelve `false` si el trabajo ya no es de este runner. */
  async appendLogs(
    runner: Runner,
    jobId: string,
    text: string,
  ): Promise<boolean> {
    const job = await this.jobs.findById(jobId);
    if (!job || job.status !== 'running' || job.runnerId !== runner.id) {
      return false;
    }
    job.appendLogs(text);
    await this.jobs.save(job);
    return true;
  }

  /** El runner terminó un trabajo. Si se canceló mientras corría, el resultado se descarta. */
  async finish(
    runner: Runner,
    jobId: string,
    outcome: JobOutcome,
  ): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job || job.status !== 'running' || job.runnerId !== runner.id) return;

    const cost = outcome.costUsd ?? null;
    if (outcome.ok) {
      job.complete(outcome.result ?? {}, cost);
    } else {
      job.fail(outcome.error || 'The runner reported a failure', cost);
    }
    await this.jobs.save(job);
    await this.executions.handleFinished(job);
  }

  /** Falla los trabajos de runners que dejaron de dar señales (PC apagado o sin red). */
  async failStaleJobs(now = new Date()): Promise<number> {
    let failed = 0;

    for (const job of await this.jobs.findRunning()) {
      const runner = job.runnerId
        ? await this.runners.findById(job.runnerId)
        : null;
      const lastSeen = runner?.lastSeenAt?.getTime() ?? 0;
      if (now.getTime() - lastSeen < STALE_JOB_MS) continue;

      this.logger.warn(`Job ${job.id} lost: its runner stopped answering`);
      job.fail('The runner stopped answering (is the PC off or offline?)');
      await this.jobs.save(job);
      await this.executions.handleFinished(job);
      failed++;
    }
    return failed;
  }
}
