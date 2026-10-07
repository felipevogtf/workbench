import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Plan } from '@planner/domain/entities/plan.entity';
import { PlanStatus } from '@planner/domain/entities/plan.props';
import { PlanRepositoryPort } from '@planner/domain/ports/plan-repository.port';
import { PlanOrmEntity } from '@planner/infrastructure/persistence/plan.orm-entity';

const ACTIVE: PlanStatus[] = ['pending', 'generating'];

@Injectable()
export class TypeOrmPlanRepository implements PlanRepositoryPort {
  constructor(
    @InjectRepository(PlanOrmEntity)
    private readonly repository: Repository<PlanOrmEntity>,
  ) {}

  async findById(id: string): Promise<Plan | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByIssueId(issueId: string): Promise<Plan[]> {
    const rows = await this.repository.find({
      where: { issue_id: issueId },
      order: { created_at: 'DESC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByStatus(status: PlanStatus): Promise<Plan[]> {
    const rows = await this.repository.find({
      where: { status },
      order: { queued_at: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findActiveByIssueId(issueId: string): Promise<Plan | null> {
    const orm = await this.repository.findOne({
      where: { issue_id: issueId, status: In(ACTIVE) },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async save(plan: Plan): Promise<Plan> {
    const saved = await this.repository.save({
      id: plan.id,
      issue_id: plan.issueId,
      status: plan.status,
      content: plan.content,
      requested_agent_id: plan.requestedAgentId,
      requested_model: plan.requestedModel,
      agent_id: plan.agentId,
      agent_name: plan.agentName,
      model: plan.model,
      repos: plan.repos,
      error: plan.error,
      queued_at: plan.queuedAt,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
    });
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async claimNextPending(): Promise<Plan | null> {
    // Una sola sentencia: elige y marca el plan a la vez; SKIP LOCKED evita que dos workers
    // concurrentes tomen el mismo.
    const result: unknown = await this.repository.query(
      `UPDATE plans
          SET status = 'generating', updated_at = now()
        WHERE id = (
          SELECT id FROM plans
           WHERE status = 'pending'
           ORDER BY queued_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING *`,
    );

    // Según el driver, UPDATE ... RETURNING devuelve [filas, cantidad] o filas.
    const rows = (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    ) as PlanOrmEntity[];

    return rows.length > 0 ? this.toDomain(rows[0]) : null;
  }

  private toDomain(orm: PlanOrmEntity): Plan {
    return Plan.reconstruct({
      id: orm.id,
      issueId: orm.issue_id,
      status: orm.status as PlanStatus,
      content: orm.content,
      requestedAgentId: orm.requested_agent_id,
      requestedModel: orm.requested_model,
      agentId: orm.agent_id,
      agentName: orm.agent_name,
      model: orm.model,
      repos: orm.repos ?? [],
      error: orm.error,
      queuedAt: orm.queued_at,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }
}
