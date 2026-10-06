export class AgentResponseDto {
  id!: string;
  name!: string;
  systemPrompt!: string;
  model!: string;
  allowedTools!: string[];
  isDefault!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
