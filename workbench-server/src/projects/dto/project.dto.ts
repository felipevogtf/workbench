import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  MAX_ARCHITECTURE_RULES,
  MAX_PROJECT_NAME,
  MAX_RECIPE_CONTENT,
  MAX_RECIPE_DEPENDENCIES,
  MAX_REF_LENGTH,
  MAX_VERIFY_COMMAND,
} from '@projects/domain/entities/project.entity';

const REPO = /^[\w.-]+\/[\w.-]+$/;
const REPO_MESSAGE = 'must look like "organization/repository"';

/** Lo que se puede cambiar de un proyecto; el repositorio no (otro repositorio es otro proyecto). */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PROJECT_NAME)
  name?: string;

  /** El enlace para clonar; vacío para quitarlo. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  repoUrl?: string;

  /** La receta. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_RECIPE_CONTENT)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RECIPE_DEPENDENCIES)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(REPO, { each: true, message: `each dependency ${REPO_MESSAGE}` })
  dependsOn?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_REF_LENGTH)
  mainBranch?: string;

  /** Vacío para quitarla. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REF_LENGTH)
  runnerEnvironment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ARCHITECTURE_RULES)
  architectureRules?: string;

  /** Vacío para quitarlo. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VERIFY_COMMAND)
  verifyCommand?: string;
}

export class CreateProjectDto extends UpdateProjectDto {
  @IsString()
  @Matches(REPO, { message: `repo ${REPO_MESSAGE}` })
  repo!: string;

  @IsString()
  @MaxLength(MAX_RECIPE_CONTENT)
  declare content: string;
}

/** Un repositorio al que apunta alguna etiqueta. */
export class RepositoryOptionDto {
  repo!: string;
  /** Los nombres de las etiquetas que lo usan. */
  labels!: string[];
}

export class ProjectResponseDto {
  id!: string;
  repo!: string;
  name!: string;
  repoUrl!: string | null;
  /** La receta. */
  content!: string;
  dependsOn!: string[];
  mainBranch!: string;
  runnerEnvironment!: string | null;
  architectureRules!: string;
  verifyCommand!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
