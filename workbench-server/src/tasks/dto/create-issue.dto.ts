export class CreateIssueDto {
  name!: string;
  description?: string | null;
  projectId!: string;
  stateId?: string | null;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  labelIds?: string[];
}
