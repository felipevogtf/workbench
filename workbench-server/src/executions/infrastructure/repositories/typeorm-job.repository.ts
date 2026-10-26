import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '@executions/domain/entities/job.entity';
import { JobKind, JobStatus } from '@executions/domain/entities/job.props';
import { JobRepositoryPort } from '@executions/domain/ports/job-repository.port';
import { JobOrmEntity } from '@executions/infrastructure/persistence/job.orm-entity';

@Injectable()
export class TypeOrmJobRepository implements JobRepositoryPort {
  constructor(
    @InjectRepository(JobOrmEntity)
    private readonly repository: Repository<JobOrmEntity>,
  ) {}

  async findById(id: string): Promise<Job | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByExecutionId(executionId: string): Promise<Job[]> {
    const rows = await this.repository.find({
      where: { execution_id: executionId },
      order: { created_at: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findRunning(): Promise<Job[]> {
    const rows = await this.repository.find({ where: { status: 'running' } });
    return rows.map((row) => this.toDomain(row));
  }

  async save(job: Job): Promise<Job> {
    const props = job.toProps();
    const saved = await this.repository.save({
      id: props.id,
      execution_id: props.executionId,
      kind: props.kind,
      ticket_id: props.ticketId,
      status: props.status,
      payload: props.payload,
      result: props.result,
      logs: props.logs,
      error: props.error,
      runner_id: props.runnerId,
      attempt: props.attempt,
      cost_usd: props.costUsd,
      queued_at: props.queuedAt,
      started_at: props.startedAt,
      finished_at: props.finishedAt,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    });
    return this.toDomain(saved);
  }

  async claimNext(runnerId: string): Promise<Job | null> {
    // Una sola sentencia: elige y toma el trabajo a la vez; SKIP LOCKED evita que dos runners
    // concurrentes tomen el mismo.
    const result: unknown = await this.repository.query(
      `UPDATE execution_jobs
          SET status = 'running', runner_id = $1, started_at = now(), updated_at = now()
        WHERE id = (
          SELECT id FROM execution_jobs
           WHERE status = 'pending'
           ORDER BY queued_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
      [runnerId],
    );

    // Según el driver, UPDATE ... RETURNING devuelve [filas, cantidad] o filas.
    const rows = (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    ) as JobOrmEntity[];

    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  private toDomain(orm: JobOrmEntity): Job {
    return Job.reconstruct({
      id: orm.id,
      executionId: orm.execution_id,
      kind: orm.kind as JobKind,
      ticketId: orm.ticket_id,
      status: orm.status as JobStatus,
      payload: orm.payload,
      result: orm.result,
      logs: orm.logs ?? '',
      error: orm.error,
      runnerId: orm.runner_id,
      attempt: orm.attempt,
      costUsd: orm.cost_usd,
      queuedAt: orm.queued_at,
      startedAt: orm.started_at,
      finishedAt: orm.finished_at,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }
}
