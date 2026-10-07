import { IsArray, IsUUID } from 'class-validator';

export class ReorderStatesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}
