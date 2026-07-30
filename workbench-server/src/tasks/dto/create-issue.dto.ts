export class CreateIssueDto {
  name!: string;
  description?: string | null;
  projectId!: string;
}
