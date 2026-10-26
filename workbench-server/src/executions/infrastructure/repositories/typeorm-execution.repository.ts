import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Execution } from '@executions/domain/entities/execution.entity';
import { ExecutionStatus } from '@executions/domain/entities/execution.props';
import { ExecutionRepositoryPort } from '@executions/domain/ports/execution-repository.port';
import { ExecutionOrmEntity } from '@executions/infrastructure/persistence/execution.orm-entity';

@Injectable()
export class TypeOrmExecutionRepository implements ExecutionRepositoryPort {
  constructor(
    @InjectRepository(ExecutionOrmEntity)
    private readonly repository: Repository<ExecutionOrmEntity>,
  ) {}

  async findById(id: string): Promise<Execution | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByIssueId(issueId: string): Promise<Execution[]> {
    const rows = await this.repository.find({
      where: { issue_id: issueId },
      order: { created_at: 'DESC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findRecent(limit: number): Promise<Execution[]> {
    const rows = await this.repository.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findActiveByIssueId(issueId: string): Promise<Execution | null> {
    const orm = await this.repository.findOne({
      where: { issue_id: issueId, status: In(['running', 'awaiting']) },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async save(execution: Execution): Promise<Execution> {
    const props = execution.toProps();
    const saved = await this.repository.save({
      id: props.id,
      issue_id: props.issueId,
      plan_id: props.planId,
      repo: props.repo,
      branch: props.branch,
      base_branch: props.baseBranch,
      extra_repos: props.extraRepos,
      status: props.status,
      stages: props.stages,
      tickets: props.tickets,
      pull_request_url: props.pullRequestUrl,
      error: props.error,
      final_review: props.finalReview ?? null,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
      finished_at: props.finishedAt,
    });
    return this.toDomain(saved);
  }

  private toDomain(orm: ExecutionOrmEntity): Execution {
    return Execution.reconstruct({
      id: orm.id,
      issueId: orm.issue_id,
      planId: orm.plan_id,
      repo: orm.repo,
      branch: orm.branch,
      baseBranch: orm.base_branch,
      extraRepos: orm.extra_repos ?? [],
      status: orm.status as ExecutionStatus,
      stages: orm.stages,
      tickets: orm.tickets ?? [],
      pullRequestUrl: orm.pull_request_url,
      error: orm.error,
      finalReview: orm.final_review ?? null,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
      finishedAt: orm.finished_at,
    });
  }
}
