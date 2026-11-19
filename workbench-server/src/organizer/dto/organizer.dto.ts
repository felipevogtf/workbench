import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const REPO = /^[\w.-]+\/[\w.-]+$/;

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** El proyecto de tareas donde vive la tarea del grupo. Sin él, la sesión es libre (sin ticket de Plane). */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /** Los proyectos (repositorios, `organización/repo`) donde se trabaja. Obligatorio en una sesión libre. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(REPO, {
    each: true,
    message: 'each project must look like "organization/repository"',
  })
  projectRepos?: string[];

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

export class AddTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;
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
  kind!: 'group' | 'task';
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
  /** `task`: la sesión de una tarea suelta (sin grupo, sin tareas que sumar). */
  kind!: 'group' | 'task';
  /** La tarea del grupo: con este id se conversa, se planifica y se ejecuta, como con cualquier tarea. */
  groupIssueId!: string;
  notes!: string | null;
  /** Los proyectos (repositorios) donde se trabaja la sesión; vacío = los de las etiquetas de sus tareas. */
  projectRepos!: string[];
  members!: SessionMemberDto[];
  createdAt!: string;
}
