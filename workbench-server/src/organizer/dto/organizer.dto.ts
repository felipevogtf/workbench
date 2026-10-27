import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** El proyecto donde vive la tarea del grupo. */
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string;
}

export class SetMembersDto {
  /** Las tareas del grupo, en el orden en que se hacen. */
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('all', { each: true })
  issueIds!: string[];
}

export class SessionSummaryDto {
  id!: string;
  title!: string;
  groupIssueId!: string;
  memberCount!: number;
  createdAt!: string;
}

export class SessionMemberDto {
  id!: string;
  key!: string | null;
  name!: string;
}

export class SessionDetailDto {
  id!: string;
  title!: string;
  /** La tarea del grupo: con este id se conversa, se planifica y se ejecuta, como con cualquier tarea. */
  groupIssueId!: string;
  notes!: string | null;
  members!: SessionMemberDto[];
  createdAt!: string;
}
