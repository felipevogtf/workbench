import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateTaskProjectDto {
  /** Solo en los proyectos locales. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  /** Solo en los de Plane: si el sync trae sus tareas. */
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  /** Si el proyecto y sus tareas aparecen en la app. */
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  /** Los proyectos (repositorios) de las tareas de este proyecto de tareas que no tienen los suyos. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(/^[\w.-]+\/[\w.-]+$/, {
    each: true,
    message: 'each project must look like "organization/repository"',
  })
  defaultProjectRepos?: string[];
}
