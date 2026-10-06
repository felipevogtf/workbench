import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitProvider } from '@pr-review/domain/entities/pull-request.props';
import {
  PullRequestSourcePort,
  PullRequestSourceResult,
  RemotePullRequestData,
} from '@pr-review/domain/ports/pull-request-source.port';
import { PullRequestCommentPort } from '@pr-review/domain/ports/pull-request-comment.port';
import { BitbucketApiClient } from '@pr-review/infrastructure/clients/bitbucket-api.client';
import { BitbucketPullRequest } from '@pr-review/infrastructure/clients/bitbucket-api.types';

@Injectable()
export class BitbucketAdapter
  implements PullRequestSourcePort, PullRequestCommentPort
{
  readonly provider: GitProvider = 'bitbucket';
  private readonly logger = new Logger(BitbucketAdapter.name);

  constructor(
    private readonly client: BitbucketApiClient,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.client.isConfigured();
  }

  async getReviewRequestedPullRequests(): Promise<PullRequestSourceResult> {
    const workspace = this.client.workspace;
    const me = await this.client.getCurrentUser();
    const slugs = await this.resolveRepoSlugs();

    const pullRequests: RemotePullRequestData[] = [];
    const unreachableRepos: string[] = [];

    for (const slug of slugs) {
      const repo = `${workspace}/${slug}`;
      try {
        const raws = await this.client.getPullRequestsToReview(slug, me.uuid);
        pullRequests.push(...raws.map((raw) => this.toRemote(repo, raw)));
      } catch (error) {
        // Un repo sin acceso o sin PRs habilitadas no debe frenar a los demás.
        const status = error instanceof HttpException ? error.getStatus() : '?';
        this.logger.warn(`Cannot list pull requests of ${repo} (${status})`);
        unreachableRepos.push(repo);
      }
    }

    return { pullRequests, unreachableRepos };
  }

  async postComment(
    repo: string,
    externalId: string,
    markdown: string,
  ): Promise<string> {
    const comment = await this.client.postComment(repo, externalId, markdown);
    return comment.links.html.href;
  }

  private async resolveRepoSlugs(): Promise<string[]> {
    const configured = (this.config.get<string>('BITBUCKET_REPOS') ?? '')
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean);
    if (configured.length > 0) return configured;

    const repositories = await this.client.getRepositories();
    return repositories.map((repository) => repository.slug);
  }

  private toRemote(
    repo: string,
    raw: BitbucketPullRequest,
  ): RemotePullRequestData {
    return {
      provider: this.provider,
      repo,
      externalId: String(raw.id),
      url: raw.links.html.href,
      title: raw.title,
      author: raw.author.display_name,
      sourceBranch: raw.source.branch.name,
      destBranch: raw.destination.branch.name,
      headCommit: raw.source.commit.hash,
    };
  }
}
