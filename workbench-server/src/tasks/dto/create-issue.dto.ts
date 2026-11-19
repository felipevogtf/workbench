import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsUUID()
  stateId?: string | null;

  // El dominio valida los valores permitidos (prioridad, formato de fechas, rango de horas).
  @IsOptional()
  @IsString()
  priority?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsNumber()
  estimatedHours?: number | null;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  labelIds?: string[];

  /** Los repositorios de los proyectos de la tarea, `organización/repo`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(/^[\w.-]+\/[\w.-]+$/, {
    each: true,
    message: 'each project must look like "organization/repository"',
  })
  projectRepos?: string[];
}
