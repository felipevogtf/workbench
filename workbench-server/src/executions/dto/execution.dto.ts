import {
  ExecutionRepo,
  ExecutionStatus,
  ExecutionTicket,
  StageRun,
} from '@executions/domain/entities/execution.props';
import { JobKind, JobStatus } from '@executions/domain/entities/job.props';

export class JobSummaryDto {
  id!: string;
  kind!: JobKind;
  ticketId!: string | null;
  status!: JobStatus;
  attempt!: number;
  costUsd!: number | null;
  error!: string | null;
  runnerId!: string | null;
  /** El agente que hizo (o hará) el trabajo; `null` en los que no usan uno (subir la rama). */
  agentId!: string | null;
  /** Su nombre técnico: los trabajos anteriores a que se guardara el id solo se reconocen por él. */
  agentName!: string | null;
  /** Lo que respondió el desarrollador al terminar (su resumen); solo en los trabajos de desarrollo. */
  output!: string | null;
  /** El veredicto del revisor; solo en los trabajos de revisión ya terminados. */
  review!: { approved: boolean; summary: string; issues: string[] } | null;
  startedAt!: string | null;
  finishedAt!: string | null;
}

export class ExecutionResponseDto {
  id!: string;
  issueId!: string;
  repo!: ExecutionRepo;
  branch!: string;
  baseBranch!: string | null;
  status!: ExecutionStatus;
  stages!: StageRun[];
  tickets!: ExecutionTicket[];
  pullRequestUrl!: string | null;
  error!: string | null;
  createdAt!: string;
  updatedAt!: string;
  finishedAt!: string | null;
}

/** Una ejecución en el historial general: con el nombre de su tarea. */
export class ExecutionListItemDto extends ExecutionResponseDto {
  issueName!: string | null;
}

export class ExecutionDetailDto extends ExecutionResponseDto {
  jobs!: JobSummaryDto[];
  /** Hay trabajo en cola y ningún runner conectado para hacerlo. */
  waitingForRunner!: boolean;
  /** Costo total de los trabajos que ya informaron el suyo. */
  costUsd!: number;
}

export class JobLogsDto {
  logs!: string;
  status!: JobStatus;
}
