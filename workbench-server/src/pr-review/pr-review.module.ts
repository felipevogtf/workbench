import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentsModule } from '@ai-agents/ai-agents.module';
import { TasksModule } from '@tasks/tasks.module';
import { PullRequestOrmEntity } from './infrastructure/persistence/pull-request.orm-entity';
import { ReviewOrmEntity } from './infrastructure/persistence/review.orm-entity';
import { PULL_REQUEST_REPOSITORY_PORT } from './domain/ports/pull-request-repository.port';
import { REVIEW_REPOSITORY_PORT } from './domain/ports/review-repository.port';
import { PULL_REQUEST_SOURCE_PORTS } from './domain/ports/pull-request-source.port';
import { PULL_REQUEST_COMMENT_PORTS } from './domain/ports/pull-request-comment.port';
import { REPOSITORY_CHECKOUT_PORT } from './domain/ports/repository-checkout.port';
import { REVIEW_STORAGE_PORT } from './domain/ports/review-storage.port';
import { AGENTS_GATEWAY_PORT } from './domain/ports/agents-gateway.port';
import { TICKETS_GATEWAY_PORT } from './domain/ports/tickets-gateway.port';
import { TasksGatewayAdapter } from './infrastructure/adapters/tasks-gateway.adapter';
import { TypeOrmPullRequestRepository } from './infrastructure/repositories/typeorm-pull-request.repository';
import { TypeOrmReviewRepository } from './infrastructure/repositories/typeorm-review.repository';
import { BitbucketApiClient } from './infrastructure/clients/bitbucket-api.client';
import { GithubApiClient } from './infrastructure/clients/github-api.client';
import { BitbucketAdapter } from './infrastructure/adapters/bitbucket.adapter';
import { GithubAdapter } from './infrastructure/adapters/github.adapter';
import { GitCliCheckoutAdapter } from './infrastructure/adapters/git-cli-checkout.adapter';
import { LocalFileReviewStorageAdapter } from './infrastructure/adapters/local-file-review-storage.adapter';
import { AgentsGatewayAdapter } from './infrastructure/adapters/agents-gateway.adapter';
import { PullRequestsService } from './application/pull-requests.service';
import {
  REVIEW_CONCURRENCY,
  ReviewsService,
} from './application/reviews.service';
import { PullRequestsController } from './infrastructure/http/pull-requests.controller';
import { PrReviewScheduler } from './infrastructure/scheduling/pr-review.scheduler';

const ENABLED_PROVIDERS = Symbol('ENABLED_PROVIDERS');

// Cada provider es opcional: si falta su configuración, su adaptador no se registra.
function enabledProviders(
  bitbucket: BitbucketAdapter,
  github: GithubAdapter,
): (BitbucketAdapter | GithubAdapter)[] {
  const logger = new Logger('PrReviewModule');
  const enabled: (BitbucketAdapter | GithubAdapter)[] = [];

  for (const adapter of [bitbucket, github]) {
    if (adapter.isEnabled()) {
      enabled.push(adapter);
    } else {
      logger.warn(`Provider "${adapter.provider}" is not configured; disabled`);
    }
  }
  return enabled;
}

@Module({
  imports: [
    HttpModule,
    AiAgentsModule,
    TasksModule,
    TypeOrmModule.forFeature([PullRequestOrmEntity, ReviewOrmEntity]),
  ],
  controllers: [PullRequestsController],
  providers: [
    BitbucketApiClient,
    GithubApiClient,
    BitbucketAdapter,
    GithubAdapter,
    {
      provide: ENABLED_PROVIDERS,
      useFactory: enabledProviders,
      inject: [BitbucketAdapter, GithubAdapter],
    },
    { provide: PULL_REQUEST_SOURCE_PORTS, useExisting: ENABLED_PROVIDERS },
    { provide: PULL_REQUEST_COMMENT_PORTS, useExisting: ENABLED_PROVIDERS },
    {
      provide: PULL_REQUEST_REPOSITORY_PORT,
      useClass: TypeOrmPullRequestRepository,
    },
    { provide: REVIEW_REPOSITORY_PORT, useClass: TypeOrmReviewRepository },
    { provide: REPOSITORY_CHECKOUT_PORT, useClass: GitCliCheckoutAdapter },
    { provide: REVIEW_STORAGE_PORT, useClass: LocalFileReviewStorageAdapter },
    { provide: AGENTS_GATEWAY_PORT, useClass: AgentsGatewayAdapter },
    { provide: TICKETS_GATEWAY_PORT, useClass: TasksGatewayAdapter },
    {
      provide: REVIEW_CONCURRENCY,
      useFactory: (config: ConfigService) =>
        Number(config.get('REVIEW_CONCURRENCY') || 1),
      inject: [ConfigService],
    },
    ReviewsService,
    PullRequestsService,
    PrReviewScheduler,
  ],
})
export class PrReviewModule {}
