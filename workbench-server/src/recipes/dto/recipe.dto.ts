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
  MAX_RECIPE_CONTENT,
  MAX_RECIPE_DEPENDENCIES,
} from '@recipes/domain/entities/recipe.entity';

const REPO = /^[\w.-]+\/[\w.-]+$/;
const REPO_MESSAGE = 'must look like "organization/repository"';

export class CreateRecipeDto {
  @IsString()
  @Matches(REPO, { message: `repo ${REPO_MESSAGE}` })
  repo!: string;

  @IsString()
  @MaxLength(MAX_RECIPE_CONTENT)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RECIPE_DEPENDENCIES)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Matches(REPO, { each: true, message: `each dependency ${REPO_MESSAGE}` })
  dependsOn?: string[];
}

export class UpdateRecipeDto {
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
}

/** Un repositorio al que apunta alguna etiqueta. */
export class RepositoryOptionDto {
  repo!: string;
  /** Los nombres de las etiquetas que lo usan. */
  labels!: string[];
}

export class RecipeResponseDto {
  id!: string;
  repo!: string;
  content!: string;
  dependsOn!: string[];
  createdAt!: Date;
  updatedAt!: Date;
}
