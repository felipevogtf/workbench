import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
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
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '@core/api/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { TextInput } from '@shared/ui/text-input/text-input';
import { Textarea } from '@shared/ui/textarea/textarea';
import { Toast } from '@shared/ui/toast/toast';
import { ProjectsStore } from '../../data-access/projects.store';
import {
  DEFAULT_MAIN_BRANCH,
  RECIPE_TEMPLATE,
  REF_PATTERN,
  REPO_PATTERN,
  Project,
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

/**
 * Crea (`/projects/new`) o edita (`/projects/:id/edit`) un proyecto: un repositorio con su receta (Markdown, con vista previa),
 * de quién depende, sus reglas de arquitectura y su verificación. Es una página, no un diálogo: la receta y las reglas son textos largos.
 */
@Component({
  selector: 'app-project-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    FormField,
    TextInput,
    Textarea,
    MarkdownViewer,
    Button,
    Icon,
    Alert,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-form-page.html',
  styleUrl: './project-form-page.scss',
})
export class ProjectFormPage {
  /** Viene de la ruta (`withComponentInputBinding`); vacío al crear. */
  readonly id = input<string>();

  protected readonly store = inject(ProjectsStore);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  /** A donde se vuelve y se navega al guardar. */
  protected readonly base = '/projects';

  protected readonly preview = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      repo: ['', [this.validRepo]],
      dependsOn: ['', [this.validRepos]],
      content: ['', [Validators.maxLength(20_000)]],
      name: ['', [Validators.maxLength(100)]],
      repoUrl: ['', [Validators.maxLength(300)]],
      mainBranch: [DEFAULT_MAIN_BRANCH, [Validators.required, Validators.pattern(REF_PATTERN)]],
      runnerEnvironment: ['', [Validators.maxLength(100)]],
      architectureRules: ['', [Validators.maxLength(10_000)]],
      verifyCommand: ['', [Validators.maxLength(500), Validators.pattern(/^[^\r\n]*$/)]],
    },
    { validators: [linkMatchesRepo] },
  );

  protected readonly isEdit = computed(() => !!this.id());
  /** El proyecto que se edita; `null` al crear o mientras no se encuentra. */
  protected readonly project = computed<Project | null>(
    () => this.store.projects().find((item) => item.id === this.id()) ?? null,
  );
  protected readonly loading = computed(() => !this.store.loaded() && !this.store.error());
  /** Se está editando un proyecto que no existe (se borró o el enlace está mal). */
  protected readonly missing = computed(
    () => this.isEdit() && this.store.loaded() && this.project() === null,
  );

  private readonly repoValue = toSignal(this.form.controls.repo.valueChanges, { initialValue: '' });

  /** Para un proyecto nuevo: los repositorios de las etiquetas que todavía no tienen proyecto. */
  protected readonly repoSuggestions = computed(() =>
    this.store
      .options()
      .map((option) => option.repo)
      .filter((repo) => !this.store.repos().includes(repo)),
  );

  /** Como dependencia sirve cualquier repositorio conocido: el de una etiqueta o el de otro proyecto. */
  protected readonly dependencySuggestions = computed(() => [
    ...new Set([...this.store.options().map((option) => option.repo), ...this.store.repos()]),
  ]);

  /** Escribió un repositorio válido al que no apunta ninguna etiqueta (y sí hay etiquetas con repositorio). */
  protected readonly unlinked = computed(() => {
    const repo = this.repoValue().trim().toLowerCase();
    const options = this.store.options();
    return (
      options.length > 0 &&
      REPO_PATTERN.test(repo) &&
      !options.some((option) => option.repo === repo)
    );
  });

  constructor() {
    if (!this.store.loaded()) void this.store.load();
    // El formulario parte del proyecto (o vacío al crear) en cuanto hay datos; después no se pisa lo que se escribe.
    let filledFor: string | null | undefined;
    effect(() => {
      const loaded = this.store.loaded();
      const project = this.project();
      const key = this.id() ?? null;
      if (!loaded || filledFor === key || (this.isEdit() && !project)) return;
      untracked(() => {
        filledFor = key;
        this.fill(project);
      });
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.store.save(
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
      this.toast.success(this.isEdit() ? 'Proyecto guardado' : 'Proyecto creado');
      await this.router.navigateByUrl(this.base);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private fill(project: Project | null): void {
    this.preview.set(false);
    this.error.set(null);
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
    // El repositorio identifica el proyecto: al editar no se cambia.
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
