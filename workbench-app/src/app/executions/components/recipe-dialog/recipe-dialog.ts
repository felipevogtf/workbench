import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { Textarea } from '@shared/ui/textarea/textarea';
import { TextInput } from '@shared/ui/text-input/text-input';
import {
  RECIPE_TEMPLATE,
  REPO_PATTERN,
  Recipe,
  RecipeInput,
  parseRepos,
} from '../../models/recipe';

/** Crea o edita la receta de un repositorio: su texto (Markdown, con vista previa) y de quién depende. */
@Component({
  selector: 'app-recipe-dialog',
  imports: [
    ReactiveFormsModule,
    SaveDialog,
    FormField,
    TextInput,
    Textarea,
    MarkdownViewer,
    Button,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .preview {
      min-height: 8rem;
      max-height: 20rem;
      padding: var(--space-3);
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }

    .preview__empty {
      margin: 0;
      color: var(--text-color);
    }

    .content__head {
      display: flex;
      justify-content: flex-end;
    }
  `,
  template: `
    <app-save-dialog
      [(open)]="open"
      [heading]="recipe() ? 'Receta de ' + recipe()!.repo : 'Nueva receta'"
      [form]="form"
      [save]="submit"
      (opened)="reset()"
    >
      <div class="stack" [formGroup]="form">
        <app-form-field
          label="Repositorio"
          for="recipe-repo"
          required
          hint="Como en la etiqueta de la tarea: organización/repositorio."
          [error]="repoInvalid() ? 'Escribe organización/repositorio, sin espacios' : null"
        >
          <app-text-input
            inputId="recipe-repo"
            formControlName="repo"
            placeholder="garage-labs/miobra-ionicv6"
            [suggestions]="repos()"
            [invalid]="repoInvalid()"
          />
        </app-form-field>

        <app-form-field
          label="Depende de"
          for="recipe-depends"
          hint="Otros repositorios que hay que tener a mano para probar este (por ejemplo la web de la que depende la app), separados por coma."
          [error]="dependsInvalid() ? 'Cada uno debe ser organización/repositorio' : null"
        >
          <app-text-input
            inputId="recipe-depends"
            formControlName="dependsOn"
            [suggestions]="repos()"
            [invalid]="dependsInvalid()"
          />
        </app-form-field>

        <app-form-field
          label="Receta"
          for="recipe-content"
          hint="Markdown. Cómo se levanta y se prueba el proyecto: lo leen la IA que crea los tickets, quien los desarrolla y quien los revisa."
          [error]="contentInvalid() ? 'Es demasiado larga (máximo 20.000 caracteres)' : null"
        >
          <div class="content__head">
            <button
              app-button
              variant="ghost"
              size="sm"
              type="button"
              [attr.aria-pressed]="preview()"
              (click)="preview.set(!preview())"
            >
              {{ preview() ? 'Seguir escribiendo' : 'Vista previa' }}
            </button>
          </div>
          @if (preview()) {
            <div class="preview" aria-label="Vista previa de la receta">
              @if (form.controls.content.value.trim()) {
                <app-markdown-viewer [content]="form.controls.content.value" />
              } @else {
                <p class="preview__empty">La receta está vacía.</p>
              }
            </div>
          } @else {
            <app-textarea
              inputId="recipe-content"
              formControlName="content"
              mono
              [rows]="14"
              [invalid]="contentInvalid()"
            />
          }
        </app-form-field>
      </div>
    </app-save-dialog>
  `,
})
export class RecipeDialog {
  readonly open = model(false);
  /** La receta que se edita; `null` para una nueva. */
  readonly recipe = input<Recipe | null>(null);
  /** Los repositorios que ya tienen receta, como sugerencia. */
  readonly repos = input<readonly string[]>([]);
  readonly save =
    input.required<(input: RecipeInput, existing: Recipe | null) => Promise<unknown>>();

  protected readonly preview = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    repo: ['', [this.validRepo]],
    dependsOn: ['', [this.validRepos]],
    content: ['', [Validators.maxLength(20_000)]],
  });

  protected readonly submit = (): Promise<unknown> => {
    const { repo, dependsOn, content } = this.form.getRawValue();
    return this.save()(
      { repo: repo.trim(), dependsOn: parseRepos(dependsOn), content: content.trim() },
      this.recipe(),
    );
  };

  protected reset(): void {
    const recipe = this.recipe();
    this.preview.set(false);
    this.form.reset({
      repo: recipe?.repo ?? '',
      dependsOn: recipe?.dependsOn.join(', ') ?? '',
      content: recipe?.content ?? RECIPE_TEMPLATE,
    });
    // El repositorio identifica la receta: al editar no se cambia.
    if (recipe) this.form.controls.repo.disable();
    else this.form.controls.repo.enable();
  }

  protected repoInvalid(): boolean {
    const control = this.form.controls.repo;
    return control.touched && control.invalid;
  }

  protected dependsInvalid(): boolean {
    const control = this.form.controls.dependsOn;
    return control.touched && control.invalid;
  }

  protected contentInvalid(): boolean {
    return this.form.controls.content.invalid;
  }

  /** El repositorio debe tener la forma organización/repositorio; los espacios de los lados no cuentan. */
  private validRepo(control: { value: string }): { repo: true } | null {
    return REPO_PATTERN.test(control.value.trim()) ? null : { repo: true };
  }

  /** Cada repositorio de «Depende de» debe tener la forma organización/repositorio. */
  private validRepos(control: { value: string }): { repos: true } | null {
    return parseRepos(control.value).every((repo) => REPO_PATTERN.test(repo))
      ? null
      : { repos: true };
  }
}
