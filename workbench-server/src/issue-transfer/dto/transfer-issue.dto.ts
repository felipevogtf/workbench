import { IsUUID } from 'class-validator';

export class TransferIssueDto {
  @IsUUID()
  targetId!: string;
}
