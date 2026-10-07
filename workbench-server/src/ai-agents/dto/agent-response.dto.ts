export class AgentResponseDto {
  id!: string;
  name!: string;
  systemPrompt!: string;
  provider!: string;
  model!: string;
  allowedTools!: string[];
  isDefault!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
