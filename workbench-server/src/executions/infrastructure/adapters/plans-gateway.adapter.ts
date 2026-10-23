import { Injectable } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { PlansService } from '@planner/application/plans.service';
import { Plan } from '@planner/domain/entities/plan.entity';
import {
  PlansGatewayPort,
  ReadyPlan,
} from '@executions/domain/ports/gateways.port';

/** Único punto de la ejecución que conoce al módulo planner. */
@Injectable()
export class PlansGatewayAdapter implements PlansGatewayPort {
  constructor(private readonly plans: PlansService) {}

  async getLatestReadyPlan(issueId: string): Promise<ReadyPlan | null> {
    // El historial viene del más nuevo al más antiguo.
    const plans = await this.plans.listByIssue(issueId);
    return this.toReady(
      plans.find((plan) => plan.status === 'ready' && plan.content),
    );
  }

  async getPlan(id: string): Promise<ReadyPlan | null> {
    try {
      return this.toReady(await this.plans.get(id));
    } catch (error) {
      if (error instanceof DomainError && error.kind === 'not-found') {
        return null;
      }
      throw error;
    }
  }

  private toReady(plan: Plan | undefined): ReadyPlan | null {
    return plan?.content ? { id: plan.id, content: plan.content } : null;
  }
}
