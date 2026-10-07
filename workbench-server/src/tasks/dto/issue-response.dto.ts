export class IssueResponseDto {
  id!: string;
  name!: string;
  isLocal!: boolean;
  externalId!: string | null;
  remoteSequence!: number | null;
  localSequence!: number;
  externalState!: string | null;
  description!: string | null;
  priority!: string | null;
  stateId!: string | null;
  projectId!: string;
  labelIds!: readonly string[];
  startDate!: string | null;
  dueDate!: string | null;
  estimatedHours!: number | null;
  /** ISO si la tarea está cerrada (historial); null si está abierta. */
  closedAt!: string | null;
}
