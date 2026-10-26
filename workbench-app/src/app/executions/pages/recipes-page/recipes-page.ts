import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { RecipeDialog } from '../../components/recipe-dialog/recipe-dialog';
import { RecipesStore } from '../../data-access/recipes.store';
import { Recipe, RecipeInput } from '../../models/recipe';

/** Cuántos caracteres de la receta se muestran en la lista. */
const EXCERPT_CHARS = 200;

/**
 * Las recetas de los proyectos: un texto por repositorio que explica cómo se levanta y se prueba, y de qué
 * otros repositorios depende. Los agentes de las ejecuciones lo reciben en su prompt.
 */
@Component({
  selector: 'app-recipes-page',
  imports: [
    TimeAgoPipe,
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    Icon,
    IconButton,
    PageHeader,
    Skeleton,
    RecipeDialog,
  ],
  providers: [RecipesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipes-page.html',
  styleUrl: './recipes-page.scss',
})
export class RecipesPage {
  protected readonly store = inject(RecipesStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly dialogOpen = signal(false);
  /** La receta que se edita; `null` = una nueva. */
  protected readonly editing = signal<Recipe | null>(null);

  protected readonly save = (input: RecipeInput, existing: Recipe | null): Promise<unknown> =>
    this.store.save(input, existing);

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected openNew(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(recipe: Recipe): void {
    this.editing.set(recipe);
    this.dialogOpen.set(true);
  }

  /** El comienzo de la receta, en una línea, para reconocerla en la lista. */
  protected excerpt(recipe: Recipe): string {
    const text = recipe.content
      .replace(/^[\s#>*-]+/gm, '')
      .replace(/[*`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS).trimEnd()}…` : text;
  }

  protected async remove(recipe: Recipe): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Borrar la receta',
      message: `La receta de «${recipe.repo}» se borra y los agentes dejan de recibirla. Las demás recetas que dependan de este repositorio seguirán nombrándolo.`,
      confirmLabel: 'Borrar',
      tone: 'danger',
    });
    if (confirmed) await this.store.remove(recipe);
  }
}
