import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RecipesService } from '@recipes/application/recipes.service';
import { Recipe } from '@recipes/domain/entities/recipe.entity';
import {
  CreateRecipeDto,
  RecipeResponseDto,
  RepositoryOptionDto,
  UpdateRecipeDto,
} from '@recipes/dto/recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  async list(): Promise<RecipeResponseDto[]> {
    return (await this.recipes.list()).map((recipe) => this.toDto(recipe));
  }

  /** Los repositorios de las etiquetas. Va antes de `:id`, que solo acepta UUID. */
  @Get('repositories')
  repositories(): Promise<RepositoryOptionDto[]> {
    return this.recipes.repositories();
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecipeResponseDto> {
    return this.toDto(await this.recipes.get(id));
  }

  @Post()
  async create(@Body() dto: CreateRecipeDto): Promise<RecipeResponseDto> {
    return this.toDto(await this.recipes.create(dto));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
  ): Promise<RecipeResponseDto> {
    return this.toDto(await this.recipes.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.recipes.remove(id);
  }

  private toDto(recipe: Recipe): RecipeResponseDto {
    return {
      id: recipe.id,
      repo: recipe.repo,
      content: recipe.content,
      dependsOn: [...recipe.dependsOn],
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    };
  }
}
