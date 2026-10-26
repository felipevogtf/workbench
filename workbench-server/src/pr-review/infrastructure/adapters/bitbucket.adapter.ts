import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitProvider } from '@pr-review/domain/entities/pull-request.props';
import {
  PullRequestSourcePort,
  PullRequestSourceResult,
  RemotePullRequestData,
} from '@pr-review/domain/ports/pull-request-source.port';
import { PullRequestCommentPort } from '@pr-review/domain/ports/pull-request-comment.port';
import {
  NewPullRequestData,
  PullRequestCreationPort,
} from '@pr-review/domain/ports/pull-request-creation.port';
import { BitbucketApiClient } from '@pr-review/infrastructure/clients/bitbucket-api.client';
import { BitbucketPullRequest } from '@pr-review/infrastructure/clients/bitbucket-api.types';

@Injectable()
export class BitbucketAdapter
  implements
    PullRequestSourcePort,
    PullRequestCommentPort,
    PullRequestCreationPort
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
        pullRequests.push(
          ...raws.map((raw) => this.toRemote(repo, raw, me.uuid)),
        );
      } catch (error) {
        // Un repo sin acceso o sin PRs habilitadas no debe frenar a los demás.
        const status = error instanceof HttpException ? error.getStatus() : '?';
        this.logger.warn(`Cannot list pull requests of ${repo} (${status})`);
        unreachableRepos.push(repo);
      }
    }

    return { pullRequests, unreachableRepos };
  }

  async getPullRequest(
    repo: string,
    externalId: string,
  ): Promise<RemotePullRequestData | null> {
    try {
      return this.toRemote(
        repo,
        await this.client.getPullRequest(repo, externalId),
      );
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 404) {
        return null;
      }
      throw error;
    }
  }

  async getDiff(repo: string, externalId: string): Promise<string | null> {
    try {
      return await this.client.getPullRequestDiff(repo, externalId);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 404) {
        return null;
      }
      throw error;
    }
  }

  async getFile(
    repo: string,
    externalId: string,
    path: string,
  ): Promise<string | null> {
    try {
      // El commit se pide a la PR en este momento: así se lee lo último que tiene la rama.
      const pullRequest = await this.client.getPullRequest(repo, externalId);
      return await this.client.getFileContent(
        repo,
        pullRequest.source.commit.hash,
        path,
      );
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 404) {
        return null;
      }
      throw error;
    }
  }

  async postComment(
    repo: string,
    externalId: string,
    markdown: string,
  ): Promise<string> {
    const comment = await this.client.postComment(repo, externalId, markdown);
    return comment.links.html.href;
  }

  async create(data: NewPullRequestData): Promise<{ url: string }> {
    // Bitbucket no deja que el autor (el dueño del token) se revise a sí mismo.
    const me = await this.client.getCurrentUser();
    const reviewerUuids = data.reviewerIds.filter((uuid) => uuid !== me.uuid);
    const body = {
      title: data.title,
      description: data.description,
      sourceBranch: data.sourceBranch,
      destBranch: data.destBranch,
    };

    try {
      const pr = await this.client.createPullRequest(data.repo, {
        ...body,
        reviewerUuids,
      });
      return { url: pr.links.html.href };
    } catch (error) {
      // Un revisor inválido no debe impedir abrir la PR: se reintenta sin revisores.
      if (
        reviewerUuids.length === 0 ||
        !(error instanceof HttpException) ||
        error.getStatus() !== 400
      ) {
        throw error;
      }
      this.logger.warn(
        `The pull request was rejected with reviewers; retrying without them`,
      );
      const pr = await this.client.createPullRequest(data.repo, {
        ...body,
        reviewerUuids: [],
      });
      return { url: pr.links.html.href };
    }
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
    myUuid?: string,
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
      description: raw.description?.trim() || null,
      authoredByMe: !!myUuid && raw.author.uuid === myUuid,
    };
  }
}
