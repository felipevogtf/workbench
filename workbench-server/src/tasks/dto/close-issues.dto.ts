import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class CloseIssuesDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  ids!: string[];
}
