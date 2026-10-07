import { IsUUID } from 'class-validator';

export class AddIssueToBoardDto {
  @IsUUID()
  issueId!: string;
}
