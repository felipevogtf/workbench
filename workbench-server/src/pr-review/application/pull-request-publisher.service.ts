import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { GitProvider } from '@pr-review/domain/entities/pull-request.props';
import {
  NewPullRequestData,
  PULL_REQUEST_CREATION_PORTS,
  type PullRequestCreationPort,
} from '@pr-review/domain/ports/pull-request-creation.port';

/** Abre PRs en el proveedor que corresponda (Bitbucket y GitHub). */
@Injectable()
export class PullRequestPublisherService {
  constructor(
    @Inject(PULL_REQUEST_CREATION_PORTS)
    private readonly creators: PullRequestCreationPort[],
  ) {}

  async create(
    provider: GitProvider,
    data: NewPullRequestData,
  ): Promise<{ url: string }> {
    const creator = this.creators.find((port) => port.provider === provider);
    if (!creator) {
      throw new DomainError(
        `Opening pull requests on ${provider} is not available (not supported or not configured)`,
      );
    }
    return creator.create(data);
  }
}
