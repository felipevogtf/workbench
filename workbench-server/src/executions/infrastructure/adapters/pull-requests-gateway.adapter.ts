import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '@core/domain/domain.error';
import { PullRequestPublisherService } from '@pr-review/application/pull-request-publisher.service';
import { GitProvider } from '@pr-review/domain/entities/pull-request.props';
import {
  NewPullRequest,
  PullRequestsGatewayPort,
} from '@executions/domain/ports/gateways.port';

const PROVIDER_OF_HOST: Record<string, GitProvider> = {
  'bitbucket.org': 'bitbucket',
  'github.com': 'github',
};

/** Único punto de la ejecución que conoce al módulo pr-review. */
@Injectable()
export class PullRequestsGatewayAdapter implements PullRequestsGatewayPort {
  constructor(
    private readonly publisher: PullRequestPublisherService,
    private readonly config: ConfigService,
  ) {}

  async create(request: NewPullRequest): Promise<{ url: string }> {
    const provider = PROVIDER_OF_HOST[request.host];
    if (!provider) {
      throw new DomainError(`Unknown repository host: ${request.host}`);
    }

    return this.publisher.create(provider, {
      repo: request.repo,
      sourceBranch: request.sourceBranch,
      destBranch: request.destBranch,
      title: request.title,
      description: request.description,
      reviewerIds: this.reviewers(),
    });
  }

  /**
   * Quiénes revisan las PRs que abre el workbench: identificadores separados por coma en
   * `EXECUTIONS_PR_REVIEWERS`. Vacío = sin revisores (el autor es el dueño del token).
   */
  private reviewers(): string[] {
    return (this.config.get<string>('EXECUTIONS_PR_REVIEWERS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }
}
