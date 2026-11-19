import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { SaveDialog } from '@shared/ui/save-dialog/save-dialog';
import { Textarea } from '@shared/ui/textarea/textarea';
import { TextInput } from '@shared/ui/text-input/text-input';
import {
  DEFAULT_MAIN_BRANCH,
  RECIPE_TEMPLATE,
  REF_PATTERN,
  REPO_PATTERN,
  Project,
  ProjectInput,
  RepositoryOption,
  parseRepos,
} from '../../models/project';

/** El enlace del repositorio, si se escribió, es de GitHub o Bitbucket y apunta al mismo organización/repositorio. */
function linkMatchesRepo(group: AbstractControl): ValidationErrors | null {
  const { repo, repoUrl } = (group as FormGroup).getRawValue() as {
    repo: string;
    repoUrl: string;
  };
  const url = repoUrl.trim();
  if (!url) return null;
  const match = /^https:\/\/(?:github\.com|bitbucket\.org)\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i.exec(
    url,
  );
  return match !== null && match[1].toLowerCase() === repo.trim().toLowerCase()
    ? null
    : { link: true };
}

/** Crea o edita la receta de un repositorio: su texto (Markdown, con vista previa) y de quién depende. */
@Component({
  selector: 'app-project-dialog',
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

    .note {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--tone-warning-fg);
    }

    .content__head {
      display: flex;
      justify-content: flex-end;
    }
  `,
  template: `
    <app-save-dialog
      [(open)]="open"
      [heading]="project() ? 'Proyecto ' + project()!.repo : 'Nuevo proyecto'"
      [form]="form"
      [save]="submit"
      (opened)="reset()"
    >
      <div class="stack" [formGroup]="form">
        <app-form-field
          label="Repositorio"
          for="project-repo"
          required
          hint="Elige uno de los repositorios de tus etiquetas (haz clic en el campo) o escribe organización/repositorio."
          [error]="repoInvalid() ? 'Escribe organización/repositorio, sin espacios' : null"
        >
          <app-text-input
            inputId="project-repo"
            formControlName="repo"
            placeholder="garage-labs/miobra-ionicv6"
            [suggestions]="repoSuggestions()"
            [invalid]="repoInvalid()"
          />
        </app-form-field>

        @if (unlinked()) {
          <p class="note" role="status">
            Ninguna etiqueta apunta a este repositorio: el proyecto solo se usará cuando la etiqueta
            de una tarea tenga su enlace.
          </p>
        }

        <app-form-field label="Nombre" for="project-name" hint="Cómo se ve en la lista. Si lo dejas vacío, el nombre del repositorio.">
          <app-text-input inputId="project-name" formControlName="name" />
        </app-form-field>

        <app-form-field
          label="Enlace del repositorio"
          for="project-url"
          hint="Para clonarlo: https://github.com/organización/repo o https://bitbucket.org/organización/repo. Sin él, el proyecto solo sirve como receta."
          [error]="urlInvalid() ? 'Debe ser un enlace de GitHub o Bitbucket al mismo organización/repositorio' : null"
        >
          <app-text-input
            inputId="project-url"
            formControlName="repoUrl"
            placeholder="https://github.com/garage-labs/miobra-ionicv6"
            [invalid]="urlInvalid()"
          />
        </app-form-field>

        <app-form-field
          label="Rama principal"
          for="project-branch"
          required
          [error]="branchInvalid() ? 'Escribe un nombre de rama válido, sin espacios' : null"
        >
          <app-text-input
            inputId="project-branch"
            formControlName="mainBranch"
            placeholder="main"
            [invalid]="branchInvalid()"
          />
        </app-form-field>

        <app-form-field
          label="Depende de"
          for="project-depends"
          hint="Otros repositorios que hay que tener a mano para probar este (por ejemplo la web de la que depende la app), separados por coma."
          [error]="dependsInvalid() ? 'Cada uno debe ser organización/repositorio' : null"
        >
          <app-text-input
            inputId="project-depends"
            formControlName="dependsOn"
            [suggestions]="dependencySuggestions()"
            [invalid]="dependsInvalid()"
          />
        </app-form-field>

        <app-form-field
          label="Receta"
          for="project-content"
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
              inputId="project-content"
              formControlName="content"
              mono
              [rows]="14"
              [invalid]="contentInvalid()"
            />
          }
        </app-form-field>

        <app-form-field
          label="Reglas de arquitectura"
          for="project-rules"
          hint="Markdown. Capas, dónde va cada cosa y qué no se hace. Las leen quien desarrolla y quien revisa."
          [error]="rulesInvalid() ? 'Es demasiado largo (máximo 10.000 caracteres)' : null"
        >
          <app-textarea
            inputId="project-rules"
            formControlName="architectureRules"
            mono
            [rows]="6"
            [invalid]="rulesInvalid()"
          />
        </app-form-field>

        <app-form-field
          label="Comando de verificación"
          for="project-verify"
          hint="Debe pasar antes de publicar (por ejemplo el chequeo de capas). Es solo el nombre: el runner decide qué ejecuta."
          [error]="verifyInvalid() ? 'Una sola línea, de hasta 500 caracteres' : null"
        >
          <app-text-input
            inputId="project-verify"
            formControlName="verifyCommand"
            [invalid]="verifyInvalid()"
          />
        </app-form-field>

        <app-form-field
          label="Entorno del runner"
          for="project-environment"
          hint="Solo si el entorno del runner no se llama como el repositorio. Vacío para usar el del repositorio."
        >
          <app-text-input inputId="project-environment" formControlName="runnerEnvironment" />
        </app-form-field>
      </div>
    </app-save-dialog>
  `,
})
export class ProjectDialog {
  readonly open = model(false);
  /** La receta que se edita; `null` para una nueva. */
  readonly project = input<Project | null>(null);
  /** Los repositorios a los que apuntan las etiquetas: de ahí se elige. */
  readonly options = input<readonly RepositoryOption[]>([]);
  /** Los repositorios que ya tienen receta. */
  readonly projectRepos = input<readonly string[]>([]);
  readonly save =
    input.required<(input: ProjectInput, existing: Project | null) => Promise<unknown>>();

  protected readonly preview = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    repo: ['', [this.validRepo]],
    dependsOn: ['', [this.validRepos]],
    content: ['', [Validators.maxLength(20_000)]],
    name: ['', [Validators.maxLength(100)]],
    repoUrl: ['', [Validators.maxLength(300)]],
    mainBranch: [DEFAULT_MAIN_BRANCH, [Validators.required, Validators.pattern(REF_PATTERN)]],
    runnerEnvironment: ['', [Validators.maxLength(100)]],
    architectureRules: ['', [Validators.maxLength(10_000)]],
    verifyCommand: ['', [Validators.maxLength(500), Validators.pattern(/^[^\r\n]*$/)]],
  }, { validators: [linkMatchesRepo] });

  private readonly repoValue = toSignal(this.form.controls.repo.valueChanges, { initialValue: '' });

  /** Para una receta nueva: los repositorios de las etiquetas que todavía no tienen receta. */
  protected readonly repoSuggestions = computed(() =>
    this.options()
      .map((option) => option.repo)
      .filter((repo) => !this.projectRepos().includes(repo)),
  );

  /** Como dependencia sirve cualquier repositorio conocido: el de una etiqueta o el de otra receta. */
  protected readonly dependencySuggestions = computed(() => [
    ...new Set([...this.options().map((option) => option.repo), ...this.projectRepos()]),
  ]);

  /** Escribió un repositorio válido al que no apunta ninguna etiqueta (y sí hay etiquetas con repositorio). */
  protected readonly unlinked = computed(() => {
    const repo = this.repoValue().trim().toLowerCase();
    return (
      this.options().length > 0 &&
      REPO_PATTERN.test(repo) &&
      !this.options().some((option) => option.repo === repo)
    );
  });

  protected readonly submit = (): Promise<unknown> => {
    const value = this.form.getRawValue();
    return this.save()(
      {
        repo: value.repo.trim(),
        dependsOn: parseRepos(value.dependsOn),
        content: value.content.trim(),
        name: value.name.trim(),
        repoUrl: value.repoUrl.trim(),
        mainBranch: value.mainBranch.trim(),
        runnerEnvironment: value.runnerEnvironment.trim(),
        architectureRules: value.architectureRules.trim(),
        verifyCommand: value.verifyCommand.trim(),
      },
      this.project(),
    );
  };

  protected reset(): void {
    const project = this.project();
    this.preview.set(false);
    this.form.reset({
      repo: project?.repo ?? '',
      dependsOn: project?.dependsOn.join(', ') ?? '',
      content: project?.content ?? RECIPE_TEMPLATE,
      name: project?.name ?? '',
      repoUrl: project?.repoUrl ?? '',
      mainBranch: project?.mainBranch ?? DEFAULT_MAIN_BRANCH,
      runnerEnvironment: project?.runnerEnvironment ?? '',
      architectureRules: project?.architectureRules ?? '',
      verifyCommand: project?.verifyCommand ?? '',
    });
    // El repositorio identifica la receta: al editar no se cambia.
    if (project) this.form.controls.repo.disable();
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

  /** El enlace debe ser de GitHub o Bitbucket y apuntar al repositorio del proyecto (el servidor lo vuelve a comprobar). */
  protected urlInvalid(): boolean {
    return this.form.hasError('link') && this.form.controls.repoUrl.touched;
  }

  protected branchInvalid(): boolean {
    const control = this.form.controls.mainBranch;
    return control.touched && control.invalid;
  }

  protected rulesInvalid(): boolean {
    return this.form.controls.architectureRules.invalid;
  }

  protected verifyInvalid(): boolean {
    return this.form.controls.verifyCommand.invalid;
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
