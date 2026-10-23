import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentsModule } from '@ai-agents/ai-agents.module';
import { PlannerModule } from '@planner/planner.module';
import { PrReviewModule } from '@pr-review/pr-review.module';
import { TasksModule } from '@tasks/tasks.module';
import { ExecutionsService } from './application/executions.service';
import { RunnerJobsService } from './application/runner-jobs.service';
import { RunnersService } from './application/runners.service';
import { EXECUTION_REPOSITORY_PORT } from './domain/ports/execution-repository.port';
import {
  AGENTS_GATEWAY_PORT,
  PLANS_GATEWAY_PORT,
  PULL_REQUESTS_GATEWAY_PORT,
  TASKS_GATEWAY_PORT,
} from './domain/ports/gateways.port';
import { JOB_REPOSITORY_PORT } from './domain/ports/job-repository.port';
import { RUNNER_REPOSITORY_PORT } from './domain/ports/runner-repository.port';
import { AgentsGatewayAdapter } from './infrastructure/adapters/agents-gateway.adapter';
import { PlansGatewayAdapter } from './infrastructure/adapters/plans-gateway.adapter';
import { PullRequestsGatewayAdapter } from './infrastructure/adapters/pull-requests-gateway.adapter';
import { TasksGatewayAdapter } from './infrastructure/adapters/tasks-gateway.adapter';
import { ExecutionsController } from './infrastructure/http/executions.controller';
import { RunnerApiController } from './infrastructure/http/runner-api.controller';
import { RunnerAuthGuard } from './infrastructure/http/runner-auth.guard';
import { RunnersController } from './infrastructure/http/runners.controller';
import { ExecutionOrmEntity } from './infrastructure/persistence/execution.orm-entity';
import { JobOrmEntity } from './infrastructure/persistence/job.orm-entity';
import { RunnerOrmEntity } from './infrastructure/persistence/runner.orm-entity';
import { TypeOrmExecutionRepository } from './infrastructure/repositories/typeorm-execution.repository';
import { TypeOrmJobRepository } from './infrastructure/repositories/typeorm-job.repository';
import { TypeOrmRunnerRepository } from './infrastructure/repositories/typeorm-runner.repository';
import { ExecutionsRecovery } from './infrastructure/scheduling/executions-recovery';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExecutionOrmEntity,
      JobOrmEntity,
      RunnerOrmEntity,
    ]),
    TasksModule,
    PlannerModule,
    AiAgentsModule,
    PrReviewModule,
  ],
  controllers: [ExecutionsController, RunnersController, RunnerApiController],
  providers: [
    {
      provide: EXECUTION_REPOSITORY_PORT,
      useClass: TypeOrmExecutionRepository,
    },
    { provide: JOB_REPOSITORY_PORT, useClass: TypeOrmJobRepository },
    { provide: RUNNER_REPOSITORY_PORT, useClass: TypeOrmRunnerRepository },
    { provide: TASKS_GATEWAY_PORT, useClass: TasksGatewayAdapter },
    { provide: PLANS_GATEWAY_PORT, useClass: PlansGatewayAdapter },
    { provide: AGENTS_GATEWAY_PORT, useClass: AgentsGatewayAdapter },
    {
      provide: PULL_REQUESTS_GATEWAY_PORT,
      useClass: PullRequestsGatewayAdapter,
    },
    ExecutionsService,
    RunnersService,
    RunnerJobsService,
    RunnerAuthGuard,
    ExecutionsRecovery,
  ],
})
export class ExecutionsModule {}
