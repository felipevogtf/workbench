export class AgentResponseDto {
  id!: string;
  name!: string;
  systemPrompt!: string;
  module!: string;
  provider!: string;
  model!: string;
  allowedTools!: string[];
  isDefault!: boolean;
  displayName!: string | null;
  avatar!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
