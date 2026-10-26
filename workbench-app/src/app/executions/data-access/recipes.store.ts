import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { Toast } from '@shared/ui/toast/toast';
import { Recipe, RecipeInput, RepositoryOption } from '../models/recipe';
import { RecipesApi } from './recipes.api';

/** Las recetas de los proyectos, una por repositorio. */
@Injectable()
export class RecipesStore {
  private readonly api = inject(RecipesApi);
  private readonly toast = inject(Toast);

  private readonly items = signal<Recipe[]>([]);
  private readonly optionItems = signal<RepositoryOption[]>([]);
  private readonly loadingState = signal(false);
  private readonly loadedState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly recipes = this.items.asReadonly();
  /** Los repositorios a los que apuntan las etiquetas, con los nombres de las etiquetas. */
  readonly options = this.optionItems.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Los repositorios que ya tienen receta. */
  readonly repos = computed(() => this.items().map((recipe) => recipe.repo));

  async load(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [recipes, options] = await Promise.all([
        firstValueFrom(this.api.list()),
        // Sin las etiquetas se puede seguir: solo se pierde la ayuda para elegir el repositorio.
        firstValueFrom(this.api.repositories()).catch(() => [] as RepositoryOption[]),
      ]);
      this.items.set(recipes);
      this.optionItems.set(options);
      this.loadedState.set(true);
    } catch (error) {
      this.errorState.set(errorMessage(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  /** Los nombres de las etiquetas que apuntan a ese repositorio; vacío si ninguna. */
  labelsOf(repo: string): string[] {
    return this.optionItems().find((option) => option.repo === repo.toLowerCase())?.labels ?? [];
  }

  /**
   * Crea la receta, o cambia la que ya tiene el repositorio. Si falla lanza el error, para que el diálogo de
   * edición lo muestre y siga abierto con lo que el usuario escribió.
   */
  async save(input: RecipeInput, existing: Recipe | null): Promise<Recipe> {
    const saved = existing
      ? await firstValueFrom(
          this.api.update(existing.id, { content: input.content, dependsOn: input.dependsOn }),
        )
      : await firstValueFrom(this.api.create(input));
    this.items.update((list) =>
      existing
        ? list.map((recipe) => (recipe.id === saved.id ? saved : recipe))
        : [...list, saved].sort((a, b) => a.repo.localeCompare(b.repo)),
    );
    return saved;
  }

  async remove(recipe: Recipe): Promise<boolean> {
    try {
      await firstValueFrom(this.api.remove(recipe.id));
      this.items.update((list) => list.filter((item) => item.id !== recipe.id));
      return true;
    } catch (error) {
      this.toast.error(errorMessage(error));
      return false;
    }
  }
}
