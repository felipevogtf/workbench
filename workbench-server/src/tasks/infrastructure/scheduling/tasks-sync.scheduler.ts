import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { TasksSyncService } from '@tasks/application/tasks-sync.service';

const JOB_NAME = 'tasks-sync';
// Cada hora, en punto (el primer campo son los segundos).
const DEFAULT_CRON = '0 0 * * * *';

/**
 * Adaptador de entrada: dispara el sync periódico con Plane. Solo habla con
 * el servicio de sync.
 */
@Injectable()
export class TasksSyncScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TasksSyncScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly syncService: TasksSyncService,
  ) {}

  onApplicationBootstrap(): void {
    const expression =
      this.config.get<string>('TASKS_SYNC_CRON') || DEFAULT_CRON;
    const job = new CronJob(expression, () => void this.tick());
    this.registry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Plane sync scheduled with "${expression}"`);
  }

  onApplicationShutdown(): void {
    if (this.registry.doesExist('cron', JOB_NAME)) {
      this.registry.deleteCronJob(JOB_NAME);
    }
  }

  private async tick(): Promise<void> {
    try {
      const { projects, issues, failedProjects } =
        await this.syncService.syncAll();
      this.logger.log(
        `Sync done: projects ${projects.created} new/${projects.updated} updated, issues ${issues.created} new/${issues.updated} updated, ${failedProjects.length} project(s) failed`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
