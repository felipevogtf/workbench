import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PullRequestsService } from '@pr-review/application/pull-requests.service';
import { ReviewsService } from '@pr-review/application/reviews.service';

const JOB_NAME = 'pr-review-sync';
// Cada 30 minutos (el primer campo son los segundos).
const DEFAULT_CRON = '0 */30 * * * *';

/**
 * Adaptador de entrada: dispara el sync periódico. Solo habla con servicios;
 * el sync deja las PRs nuevas en cola y despierta a los workers.
 */
@Injectable()
export class PrReviewScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PrReviewScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly pullRequestsService: PullRequestsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const interrupted = await this.reviewsService.recoverInterrupted();
      if (interrupted > 0) {
        this.logger.warn(`${interrupted} interrupted review(s) marked failed`);
      }
    } catch (error) {
      this.logger.error(
        `Could not recover the review queue: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const expression = this.config.get<string>('PR_SYNC_CRON') || DEFAULT_CRON;
    const job = new CronJob(expression, () => void this.tick());
    this.registry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Pull request sync scheduled with "${expression}"`);
  }

  onApplicationShutdown(): void {
    if (this.registry.doesExist('cron', JOB_NAME)) {
      this.registry.deleteCronJob(JOB_NAME);
    }
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.pullRequestsService.sync();
      this.logger.log(
        `Sync done: ${result.created} new, ${result.updated} updated, ${result.closed} closed`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
