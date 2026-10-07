import { Injectable } from '@nestjs/common';
import { IssueRepositoryPort } from '@tasks/domain/ports/issue-repository.port';
import { DataSource, DeepPartial, In, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Issue } from '@tasks/domain/entities/issue.entity';
import { IssueProps } from '@tasks/domain/entities/issue.props';
import { IssueOrmEntity } from '@tasks/infrastructure/persistence/issue.orm-entity';

@Injectable()
export class TypeOrmIssueRepository implements IssueRepositoryPort {
  constructor(
    @InjectRepository(IssueOrmEntity)
    private readonly issueRepository: Repository<IssueOrmEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
      relations: { project: true, state: true, labels: true },
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

  async setClosed(ids: string[], closedAt: Date | null): Promise<number> {
    if (ids.length === 0) return 0;

    // Una sola sentencia (cerrar ~500 tareas no debe ser 500 guardados). Solo toca las que
    // cambian de estado, y no mueve `synced_at`: cerrar no es un cambio del dato de Plane.
    const [, affected] = await this.issueRepository.manager.query<
      [unknown, number]
    >(
      `UPDATE issues SET closed_at = $2
        WHERE id = ANY($1::uuid[])
          AND closed_at IS ${closedAt ? '' : 'NOT '}NULL
        `,
      [ids, closedAt],
    );
    return affected;
  }

  async nextLocalSequence(projectId: string): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      // Advisory lock por proyecto: serializa dos inserts concurrentes en el
      // mismo proyecto sin bloquear inserts de otros proyectos (no toca la
      // fila de `projects`, así que no interfiere con updates a Project).
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        projectId,
      ]);

      const result = await manager
        .createQueryBuilder(IssueOrmEntity, 'issue')
        .select('MAX(issue.local_sequence)', 'max')
        .where('issue.project_id = :projectId', { projectId })
        .getRawOne<{ max: number | null }>();

      return (result?.max ?? 0) + 1;
    });
  }

  private toDomain(issueOrmEntity: IssueOrmEntity): Issue {
    const props: IssueProps = {
      id: issueOrmEntity.id,
      name: issueOrmEntity.name,
      isLocal: issueOrmEntity.is_local,
      externalId: issueOrmEntity.external_id,
      remoteSequence: issueOrmEntity.remote_sequence,
      localSequence: issueOrmEntity.local_sequence,
      externalState: issueOrmEntity.external_state,
      description: issueOrmEntity.description,
      // Postgres devuelve los decimal como string.
      estimatedHours:
        issueOrmEntity.estimated_hours === null
          ? null
          : Number(issueOrmEntity.estimated_hours),
      priority: issueOrmEntity.priority,
      stateId: issueOrmEntity.state?.id || null,
      projectId: issueOrmEntity.project.id,
      labelIds: issueOrmEntity.labels?.map((label) => label.id) || [],
      startDate: issueOrmEntity.start_date,
      dueDate: issueOrmEntity.due_date,
      closedAt: issueOrmEntity.closed_at,
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
      remote_sequence: issue.remoteSequence,
      local_sequence: issue.localSequence,
      estimated_hours: issue.estimatedHours,
      closed_at: issue.closedAt,
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
