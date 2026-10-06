import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  GitProvider,
  PullRequestState,
  PullRequestStatus,
} from '@pr-review/domain/entities/pull-request.props';
import {
  PullRequestFilters,
  PullRequestRepositoryPort,
} from '@pr-review/domain/ports/pull-request-repository.port';
import { PullRequestOrmEntity } from '@pr-review/infrastructure/persistence/pull-request.orm-entity';

@Injectable()
export class TypeOrmPullRequestRepository implements PullRequestRepositoryPort {
  constructor(
    @InjectRepository(PullRequestOrmEntity)
    private readonly pullRequestRepository: Repository<PullRequestOrmEntity>,
  ) {}

  async findById(id: string): Promise<PullRequest | null> {
    const orm = await this.pullRequestRepository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByExternalKey(
    provider: GitProvider,
    repo: string,
    externalId: string,
  ): Promise<PullRequest | null> {
    const orm = await this.pullRequestRepository.findOne({
      where: { provider, repo, external_id: externalId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findAll(filters: PullRequestFilters): Promise<PullRequest[]> {
    const query = this.pullRequestRepository.createQueryBuilder('pr');

    if (filters.status) {
      query.andWhere('pr.status = :status', { status: filters.status });
    }
    if (filters.provider) {
      query.andWhere('pr.provider = :provider', {
        provider: filters.provider,
      });
    }
    if (filters.stale === true) {
      query.andWhere(
        'pr.reviewed_commit IS NOT NULL AND pr.head_commit <> pr.reviewed_commit',
      );
    } else if (filters.stale === false) {
      query.andWhere(
        '(pr.reviewed_commit IS NULL OR pr.head_commit = pr.reviewed_commit)',
      );
    }

    const rows = await query.orderBy('pr.updated_at', 'DESC').getMany();
    return rows.map((orm) => this.toDomain(orm));
  }

  async findOpenByProvider(provider: GitProvider): Promise<PullRequest[]> {
    const rows = await this.pullRequestRepository.find({
      where: { provider, state: 'open' },
    });
    return rows.map((orm) => this.toDomain(orm));
  }

  async findByStatus(status: PullRequestStatus): Promise<PullRequest[]> {
    const where: FindOptionsWhere<PullRequestOrmEntity> = { status };
    const rows = await this.pullRequestRepository.find({
      where,
      order: { queued_at: 'ASC' },
    });
    return rows.map((orm) => this.toDomain(orm));
  }

  async claimNextPending(): Promise<PullRequest | null> {
    // Una sola sentencia: elige y marca la PR a la vez; SKIP LOCKED evita que
    // dos workers concurrentes tomen la misma.
    const result: unknown = await this.pullRequestRepository.query(
      `UPDATE pull_requests
          SET status = 'reviewing', updated_at = now()
        WHERE id = (
          SELECT id FROM pull_requests
           WHERE status = 'pending' AND state = 'open'
           ORDER BY queued_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
    );

    // Según el driver, UPDATE ... RETURNING devuelve [filas, cantidad] o filas.
    const rows = (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    ) as PullRequestOrmEntity[];

    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  async save(pullRequest: PullRequest): Promise<PullRequest> {
    const saved = await this.pullRequestRepository.save({
      id: pullRequest.id,
      provider: pullRequest.provider,
      repo: pullRequest.repo,
      external_id: pullRequest.externalId,
      url: pullRequest.url,
      title: pullRequest.title,
      author: pullRequest.author,
      source_branch: pullRequest.sourceBranch,
      dest_branch: pullRequest.destBranch,
      head_commit: pullRequest.headCommit,
      state: pullRequest.state,
      status: pullRequest.status,
      queued_at: pullRequest.queuedAt,
      requested_agent_id: pullRequest.requestedAgentId,
      requested_model: pullRequest.requestedModel,
      last_reviewed_at: pullRequest.lastReviewedAt,
      review_doc_url: pullRequest.reviewDocUrl,
      reviewed_commit: pullRequest.reviewedCommit,
      last_error: pullRequest.lastError,
      created_at: pullRequest.createdAt,
      updated_at: pullRequest.updatedAt,
    });
    return this.toDomain(saved);
  }

  private toDomain(orm: PullRequestOrmEntity): PullRequest {
    return PullRequest.reconstruct({
      id: orm.id,
      provider: orm.provider as GitProvider,
      repo: orm.repo,
      externalId: orm.external_id,
      url: orm.url,
      title: orm.title,
      author: orm.author,
      sourceBranch: orm.source_branch,
      destBranch: orm.dest_branch,
      headCommit: orm.head_commit,
      state: orm.state as PullRequestState,
      status: orm.status as PullRequestStatus,
      queuedAt: orm.queued_at,
      requestedAgentId: orm.requested_agent_id,
      requestedModel: orm.requested_model,
      lastReviewedAt: orm.last_reviewed_at,
      reviewDocUrl: orm.review_doc_url,
      reviewedCommit: orm.reviewed_commit,
      lastError: orm.last_error,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }
}
