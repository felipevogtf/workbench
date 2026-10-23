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
