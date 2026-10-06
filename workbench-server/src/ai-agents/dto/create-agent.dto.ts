export class CreateAgentDto {
  name!: string;
  systemPrompt!: string;
  model!: string;
  allowedTools?: string[];
  isDefault?: boolean;
}
