export class IssueResponseDto {
  id!: string;
  name!: string;
  isLocal!: boolean;
  externalId!: string | null;
  sequenceNumber!: number | null;
  localId!: number | null;
  externalState!: string | null;
  description!: string | null;
  priority!: string | null;
  hoursWorked!: number | null;
  stateId!: string | null;
  projectId!: string;
  labelIds!: readonly string[];
  startDate!: string | null;
  dueDate!: string | null;
}
