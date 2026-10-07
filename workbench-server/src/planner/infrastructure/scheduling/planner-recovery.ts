import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PlansService } from '@planner/application/plans.service';

/** Al arrancar: marca como fallidos los planes que un corte dejó a medias y retoma la cola. */
@Injectable()
export class PlannerRecovery implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlannerRecovery.name);

  constructor(private readonly plans: PlansService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const interrupted = await this.plans.recoverInterrupted();
      if (interrupted > 0) {
        this.logger.warn(`${interrupted} interrupted plan(s) marked failed`);
      }
    } catch (error) {
      this.logger.error(
        `Could not recover the plan queue: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
