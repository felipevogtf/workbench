import { Recipe } from '../entities/recipe.entity';

export interface RecipeRepositoryPort {
  /** Todas las recetas, por repositorio. Son pocas: una por proyecto. */
  findAll(): Promise<Recipe[]>;
  findById(id: string): Promise<Recipe | null>;
  findByRepo(repo: string): Promise<Recipe | null>;
  save(recipe: Recipe): Promise<Recipe>;
  delete(id: string): Promise<void>;
}

export const RECIPE_REPOSITORY_PORT = Symbol('RECIPE_REPOSITORY_PORT');
