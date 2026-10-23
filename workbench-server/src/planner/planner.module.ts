import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentsModule } from '@ai-agents/ai-agents.module';
import { ChatAttachmentsModule } from '@core/attachments/chat-attachments.module';
import { ChatAttachmentsService } from '@core/attachments/chat-attachments.service';
import { TasksModule } from '@tasks/tasks.module';
import { PLANNER_CONCURRENCY, PlansService } from './application/plans.service';
import {
  TASK_CHAT_CONCURRENCY,
  TaskChatService,
} from './application/task-chat.service';
import { AGENTS_GATEWAY_PORT } from './domain/ports/agents-gateway.port';
import { PLAN_REPOSITORY_PORT } from './domain/ports/plan-repository.port';
import { ATTACHMENTS_PORT } from './domain/ports/attachments.port';
import { REPOS_CACHE_PORT } from './domain/ports/repos-cache.port';
import { REPOS_CHECKOUT_PORT } from './domain/ports/repos-checkout.port';
import { TASKS_GATEWAY_PORT } from './domain/ports/tasks-gateway.port';
import { TICKETS_GATEWAY_PORT } from './domain/ports/tickets-gateway.port';
import { AgentsGatewayAdapter } from './infrastructure/adapters/agents-gateway.adapter';
import { GitReposCacheAdapter } from './infrastructure/adapters/git-repos-cache.adapter';
import { GitReposCheckoutAdapter } from './infrastructure/adapters/git-repos-checkout.adapter';
import { TasksGatewayAdapter } from './infrastructure/adapters/tasks-gateway.adapter';
import { TicketsGatewayAdapter } from './infrastructure/adapters/tickets-gateway.adapter';
import { PlansController } from './infrastructure/http/plans.controller';
import { PlanOrmEntity } from './infrastructure/persistence/plan.orm-entity';
import { TypeOrmPlanRepository } from './infrastructure/repositories/typeorm-plan.repository';
import { PlannerRecovery } from './infrastructure/scheduling/planner-recovery';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlanOrmEntity]),
    TasksModule,
    AiAgentsModule,
    ChatAttachmentsModule,
  ],
  controllers: [PlansController],
  providers: [
    { provide: PLAN_REPOSITORY_PORT, useClass: TypeOrmPlanRepository },
    { provide: TASKS_GATEWAY_PORT, useClass: TasksGatewayAdapter },
    { provide: AGENTS_GATEWAY_PORT, useClass: AgentsGatewayAdapter },
    { provide: REPOS_CHECKOUT_PORT, useClass: GitReposCheckoutAdapter },
    { provide: TICKETS_GATEWAY_PORT, useClass: TicketsGatewayAdapter },
    {
      provide: PLANNER_CONCURRENCY,
      useFactory: (config: ConfigService) =>
        Number(config.get('PLANNER_CONCURRENCY') || 1),
      inject: [ConfigService],
    },
    { provide: REPOS_CACHE_PORT, useClass: GitReposCacheAdapter },
    { provide: ATTACHMENTS_PORT, useExisting: ChatAttachmentsService },
    {
      provide: TASK_CHAT_CONCURRENCY,
      useFactory: (config: ConfigService) =>
        Number(config.get('CHAT_CONCURRENCY') || 2),
      inject: [ConfigService],
    },
    PlansService,
    TaskChatService,
    PlannerRecovery,
  ],
})
export class PlannerModule {}
