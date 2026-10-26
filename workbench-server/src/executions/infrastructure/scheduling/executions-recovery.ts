import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RunnerJobsService } from '@executions/application/runner-jobs.service';

/**
 * Falla los trabajos de un runner que dejó de dar señales (PC apagado, sin red o cerrado a la fuerza),
 * para que la ejecución no quede colgada: el usuario ve el error y puede reintentar.
 */
@Injectable()
export class ExecutionsRecovery {
  private readonly logger = new Logger(ExecutionsRecovery.name);

  constructor(private readonly jobs: RunnerJobsService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async failStaleJobs(): Promise<void> {
    try {
      const failed = await this.jobs.failStaleJobs();
      if (failed > 0) this.logger.warn(`${failed} lost job(s) marked failed`);
    } catch (error) {
      this.logger.error(
        `Could not check the running jobs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
