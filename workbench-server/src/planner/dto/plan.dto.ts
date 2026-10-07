import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';

export class CreatePlanDto {
  /** Opcional: un agente del módulo `planner` distinto del que está por defecto. */
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

export class PlanResponseDto {
  id!: string;
  issueId!: string;
  status!: string;
  agentName!: string | null;
  model!: string | null;
  repos!: PlanRepoInfo[];
  error!: string | null;
  /** Solo en el detalle de un plan; el historial no lo trae. */
  content?: string | null;
  createdAt!: string;
  updatedAt!: string;
}
