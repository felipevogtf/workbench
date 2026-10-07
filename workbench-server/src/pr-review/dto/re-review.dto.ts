import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ReReviewDto {
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
