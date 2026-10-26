import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { Recipe } from '@recipes/domain/entities/recipe.entity';
import {
  RECIPE_REPOSITORY_PORT,
  type RecipeRepositoryPort,
} from '@recipes/domain/ports/recipe-repository.port';
import { buildRecipeContext } from '@recipes/domain/recipe-context';

@Injectable()
export class RecipesService {
  constructor(
    @Inject(RECIPE_REPOSITORY_PORT)
    private readonly recipes: RecipeRepositoryPort,
  ) {}

  async list(): Promise<Recipe[]> {
    const all = await this.recipes.findAll();
    return all.sort((a, b) => a.repo.localeCompare(b.repo));
  }

  async get(id: string): Promise<Recipe> {
    const recipe = await this.recipes.findById(id);
    if (!recipe) throw DomainError.notFound(`Recipe with id ${id} not found`);
    return recipe;
  }

  async create(input: {
    repo: string;
    content: string;
    dependsOn?: readonly string[];
  }): Promise<Recipe> {
    const recipe = Recipe.create(input);
    if (await this.recipes.findByRepo(recipe.repo)) {
      throw DomainError.conflict(
        `There is already a recipe for ${recipe.repo}`,
      );
    }
    return this.recipes.save(recipe);
  }

  async update(
    id: string,
    changes: { content?: string; dependsOn?: readonly string[] },
  ): Promise<Recipe> {
    const recipe = await this.get(id);
    recipe.update(changes);
    return this.recipes.save(recipe);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.recipes.delete(id);
  }

  /**
   * Lo que se le muestra a un agente de las recetas de estos repositorios (y de los que dependen), o `null`
   * si ninguno tiene receta.
   */
  async contextFor(repos: readonly string[]): Promise<string | null> {
    if (repos.length === 0) return null;
    return buildRecipeContext(repos, await this.recipes.findAll());
  }
}
