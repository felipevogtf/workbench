import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentsModule } from '@ai-agents/ai-agents.module';
import { PlannerModule } from '@planner/planner.module';
import { PrReviewModule } from '@pr-review/pr-review.module';
import { RecipesModule } from '@recipes/recipes.module';
import { TasksModule } from '@tasks/tasks.module';
import { ExecutionChatService } from './application/execution-chat.service';
import { ExecutionsService } from './application/executions.service';
import { UsageService } from './application/usage.service';
import { RunnerJobsService } from './application/runner-jobs.service';
import { RunnersService } from './application/runners.service';
import { EXECUTION_REPOSITORY_PORT } from './domain/ports/execution-repository.port';
import {
  AGENTS_GATEWAY_PORT,
  PLANS_GATEWAY_PORT,
  PULL_REQUESTS_GATEWAY_PORT,
  RECIPES_GATEWAY_PORT,
  REPOSITORIES_GATEWAY_PORT,
  TASKS_GATEWAY_PORT,
} from './domain/ports/gateways.port';
import { JOB_REPOSITORY_PORT } from './domain/ports/job-repository.port';
import { USAGE_SNAPSHOT_REPOSITORY_PORT } from './domain/ports/usage-snapshot-repository.port';
import { RUNNER_REPOSITORY_PORT } from './domain/ports/runner-repository.port';
import { AgentsGatewayAdapter } from './infrastructure/adapters/agents-gateway.adapter';
import { PlansGatewayAdapter } from './infrastructure/adapters/plans-gateway.adapter';
import { PullRequestsGatewayAdapter } from './infrastructure/adapters/pull-requests-gateway.adapter';
import { RecipesGatewayAdapter } from './infrastructure/adapters/recipes-gateway.adapter';
import { RepositoriesGatewayAdapter } from './infrastructure/adapters/repositories-gateway.adapter';
import { TasksGatewayAdapter } from './infrastructure/adapters/tasks-gateway.adapter';
import { ExecutionsController } from './infrastructure/http/executions.controller';
import { RunnerApiController } from './infrastructure/http/runner-api.controller';
import { RunnerAuthGuard } from './infrastructure/http/runner-auth.guard';
import { RunnersController } from './infrastructure/http/runners.controller';
import { UsageController } from './infrastructure/http/usage.controller';
import { ExecutionOrmEntity } from './infrastructure/persistence/execution.orm-entity';
import { JobOrmEntity } from './infrastructure/persistence/job.orm-entity';
import { RunnerOrmEntity } from './infrastructure/persistence/runner.orm-entity';
import { UsageSnapshotOrmEntity } from './infrastructure/persistence/usage-snapshot.orm-entity';
import { TypeOrmExecutionRepository } from './infrastructure/repositories/typeorm-execution.repository';
import { TypeOrmJobRepository } from './infrastructure/repositories/typeorm-job.repository';
import { TypeOrmRunnerRepository } from './infrastructure/repositories/typeorm-runner.repository';
import { TypeOrmUsageSnapshotRepository } from './infrastructure/repositories/typeorm-usage-snapshot.repository';
import { ExecutionsRecovery } from './infrastructure/scheduling/executions-recovery';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExecutionOrmEntity,
      JobOrmEntity,
      RunnerOrmEntity,
      UsageSnapshotOrmEntity,
    ]),
    TasksModule,
    PlannerModule,
    AiAgentsModule,
    PrReviewModule,
    RecipesModule,
  ],
  controllers: [
    ExecutionsController,
    RunnersController,
    RunnerApiController,
    UsageController,
  ],
  providers: [
    {
      provide: EXECUTION_REPOSITORY_PORT,
      useClass: TypeOrmExecutionRepository,
    },
    { provide: JOB_REPOSITORY_PORT, useClass: TypeOrmJobRepository },
    { provide: RUNNER_REPOSITORY_PORT, useClass: TypeOrmRunnerRepository },
    {
      provide: USAGE_SNAPSHOT_REPOSITORY_PORT,
      useClass: TypeOrmUsageSnapshotRepository,
    },
    { provide: TASKS_GATEWAY_PORT, useClass: TasksGatewayAdapter },
    { provide: PLANS_GATEWAY_PORT, useClass: PlansGatewayAdapter },
    { provide: AGENTS_GATEWAY_PORT, useClass: AgentsGatewayAdapter },
    { provide: RECIPES_GATEWAY_PORT, useClass: RecipesGatewayAdapter },
    {
      provide: REPOSITORIES_GATEWAY_PORT,
      useClass: RepositoriesGatewayAdapter,
    },
    {
      provide: PULL_REQUESTS_GATEWAY_PORT,
      useClass: PullRequestsGatewayAdapter,
    },
    ExecutionsService,
    ExecutionChatService,
    UsageService,
    RunnersService,
    RunnerJobsService,
    RunnerAuthGuard,
    ExecutionsRecovery,
  ],
})
export class ExecutionsModule {}
