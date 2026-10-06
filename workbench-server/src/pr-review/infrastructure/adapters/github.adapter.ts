import { HttpException, Injectable, Logger } from '@nestjs/common';
import { GitProvider } from '@pr-review/domain/entities/pull-request.props';
import {
  PullRequestSourcePort,
  PullRequestSourceResult,
  RemotePullRequestData,
} from '@pr-review/domain/ports/pull-request-source.port';
import { PullRequestCommentPort } from '@pr-review/domain/ports/pull-request-comment.port';
import { GithubApiClient } from '@pr-review/infrastructure/clients/github-api.client';
import { GithubPullRequest } from '@pr-review/infrastructure/clients/github-api.types';

@Injectable()
export class GithubAdapter
  implements PullRequestSourcePort, PullRequestCommentPort
{
  readonly provider: GitProvider = 'github';
  private readonly logger = new Logger(GithubAdapter.name);

  constructor(private readonly client: GithubApiClient) {}

  isEnabled(): boolean {
    return this.client.isConfigured();
  }

  async getReviewRequestedPullRequests(): Promise<PullRequestSourceResult> {
    const items = await this.client.searchReviewRequested();

    const pullRequests: RemotePullRequestData[] = [];
    const unreachableRepos: string[] = [];

    for (const item of items) {
      const repo = item.repository_url.replace(
        'https://api.github.com/repos/',
        '',
      );
      try {
        const raw = await this.client.getPullRequest(repo, item.number);
        pullRequests.push(this.toRemote(repo, raw));
      } catch (error) {
        const status = error instanceof HttpException ? error.getStatus() : '?';
        this.logger.warn(`Cannot read ${repo}#${item.number} (${status})`);
        if (!unreachableRepos.includes(repo)) unreachableRepos.push(repo);
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
    return comment.html_url;
  }

  private toRemote(
    repo: string,
    raw: GithubPullRequest,
  ): RemotePullRequestData {
    return {
      provider: this.provider,
      repo,
      externalId: String(raw.number),
      url: raw.html_url,
      title: raw.title,
      author: raw.user?.login ?? 'unknown',
      sourceBranch: raw.head.ref,
      destBranch: raw.base.ref,
      headCommit: raw.head.sha,
      description: raw.body?.trim() || null,
    };
  }
}
