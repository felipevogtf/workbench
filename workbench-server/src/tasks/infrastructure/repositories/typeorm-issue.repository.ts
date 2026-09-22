import { Injectable } from '@nestjs/common';
import { IssueRepositoryPort } from '@tasks/domain/ports/issue-repository.port';
import { DeepPartial, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Issue } from '@tasks/domain/entities/issue.entity';
import { IssueProps } from '@tasks/domain/entities/issue.props';
import { IssueOrmEntity } from '@tasks/infrastructure/persistence/issue.orm-entity';

@Injectable()
export class TypeOrmIssueRepository implements IssueRepositoryPort {
  constructor(
    @InjectRepository(IssueOrmEntity)
    private readonly issueRepository: Repository<IssueOrmEntity>,
  ) {}

  async findById(id: string): Promise<Issue | null> {
    const issueOrmEntity = await this.issueRepository.findOne({
      where: { id },
      relations: { project: true, state: true, labels: true },
    });

    return issueOrmEntity ? this.toDomain(issueOrmEntity) : null;
  }

  async findByIds(ids: string[]): Promise<Issue[]> {
    if (ids.length === 0) return [];
    const issueOrmEntities = await this.issueRepository.find({
      where: { id: In(ids) },
    });

    return issueOrmEntities.map((issueOrmEntity) =>
      this.toDomain(issueOrmEntity),
    );
  }

  async findAll(): Promise<Issue[]> {
    const issueOrmEntities = await this.issueRepository.find({
      relations: { project: true, state: true, labels: true },
    });

    return issueOrmEntities.map((issueOrmEntity) =>
      this.toDomain(issueOrmEntity),
    );
  }

  async findByExternalId(externalId: string): Promise<Issue | null> {
    const issueOrmEntity = await this.issueRepository.findOne({
      where: { external_id: externalId },
      relations: { project: true, state: true, labels: true },
    });

    return issueOrmEntity ? this.toDomain(issueOrmEntity) : null;
  }

  async findByProjectId(projectId: string): Promise<Issue[]> {
    const issueOrmEntities = await this.issueRepository.find({
      where: { project: { id: projectId } },
      relations: { project: true, state: true, labels: true },
    });

    return issueOrmEntities.map((issueOrmEntity) =>
      this.toDomain(issueOrmEntity),
    );
  }

  async save(issue: Issue): Promise<void> {
    const issueOrmEntity = this.toOrm(issue);
    await this.issueRepository.save(issueOrmEntity);
  }

  async delete(id: string): Promise<void> {
    await this.issueRepository.delete(id);
  }

  async nextLocalId(): Promise<number> {
    const max = await this.issueRepository
      .createQueryBuilder('issue')
      .where('issue.is_local = true')
      .select('MAX(issue.local_id)', 'max')
      .getRawOne<{ max: number | null }>();
    return (max?.max ?? 0) + 1;
  }

  private toDomain(issueOrmEntity: IssueOrmEntity): Issue {
    const props: IssueProps = {
      id: issueOrmEntity.id,
      name: issueOrmEntity.name,
      isLocal: issueOrmEntity.is_local,
      externalId: issueOrmEntity.external_id,
      sequenceNumber: issueOrmEntity.sequence_number,
      externalState: issueOrmEntity.external_state,
      localId: issueOrmEntity.local_id,
      description: issueOrmEntity.description,
      estimatedHours: issueOrmEntity.estimated_hours,
      priority: issueOrmEntity.priority,
      stateId: issueOrmEntity.state?.id || null,
      projectId: issueOrmEntity.project.id,
      labelIds: issueOrmEntity.labels?.map((label) => label.id) || [],
      startDate: issueOrmEntity.start_date,
      dueDate: issueOrmEntity.due_date,
      syncedAt: issueOrmEntity.synced_at,
      createdAt: issueOrmEntity.created_at,
    };

    return Issue.reconstruct(props);
  }

  private toOrm(issue: Issue): DeepPartial<IssueOrmEntity> {
    return {
      id: issue.id,
      name: issue.name,
      is_local: issue.isLocal,
      external_id: issue.externalId,
      sequence_number: issue.sequenceNumber,
      estimated_hours: issue.estimatedHours,
      local_id: issue.localId,
      external_state: issue.externalState,
      description: issue.description,
      priority: issue.priority,
      start_date: issue.startDate,
      due_date: issue.dueDate,
      project: { id: issue.projectId },
      state: issue.stateId ? { id: issue.stateId } : null,
      labels: issue.labelIds.map((id) => ({ id })),
    };
  }
}
