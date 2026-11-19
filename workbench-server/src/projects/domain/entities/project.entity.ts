import { randomUUID } from 'node:crypto';
import { DomainError } from '@core/domain/domain.error';

/** `organización/repo`, como lo escribe el usuario y como lo conoce el resto de la app. */
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
/** Una rama o una clave de entorno: sin espacios, sin `..` y sin empezar con `-` (no puede pasar como opción de git). */
const REF_PATTERN = /^[\w][\w./-]*$/;

export const MAX_RECIPE_CONTENT = 20_000;
export const MAX_RECIPE_DEPENDENCIES = 10;
export const MAX_PROJECT_NAME = 100;
export const MAX_REF_LENGTH = 100;
export const MAX_ARCHITECTURE_RULES = 10_000;
export const MAX_VERIFY_COMMAND = 500;
export const DEFAULT_MAIN_BRANCH = 'main';

export interface ProjectProps {
  id: string;
  repo: string;
  /** Nombre visible; si no se puso, el nombre del repositorio. */
  name: string;
  /** La receta: cómo se levanta y se prueba el repositorio (Markdown). */
  content: string;
  /** Otros repositorios que hay que tener a mano para probar este (ej. la web de la que depende la app). */
  dependsOn: string[];
  /** El enlace para clonar: `https://github.com/org/repo` o `https://bitbucket.org/org/repo`. `null` si no se conoce. */
  repoUrl: string | null;
  mainBranch: string;
  /** Clave del entorno en `runner.config.json` si no es el propio repositorio. Solo una referencia: el runner decide qué se ejecuta. */
  runnerEnvironment: string | null;
  /** Reglas de arquitectura del proyecto (Markdown), para quien desarrolla y quien revisa. */
  architectureRules: string;
  /** Comando que debe pasar antes de publicar. Solo se guarda: lo resuelve y lo corre el runner con su propia configuración. */
  verifyCommand: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectInput {
  repo: string;
  content: string;
  dependsOn?: readonly string[];
  name?: string | null;
  repoUrl?: string | null;
  mainBranch?: string;
  runnerEnvironment?: string | null;
  architectureRules?: string;
  verifyCommand?: string | null;
}

/** Cómo se compara un repositorio: sin espacios de los lados y en minúsculas, como lo tratan GitHub y Bitbucket. */
export function normalizeRepoName(value: string): string {
  return value.trim().toLowerCase();
}

function repoName(value: string, field: string): string {
  const name = normalizeRepoName(value);
  if (!REPO_PATTERN.test(name)) {
    throw new DomainError(
      `${field} must look like "organization/repository", got "${value}"`,
    );
  }
  return name;
}

function ref(value: string, field: string): string {
  const text = value.trim();
  if (
    text.length === 0 ||
    text.length > MAX_REF_LENGTH ||
    !REF_PATTERN.test(text) ||
    text.includes('..')
  ) {
    throw new DomainError(`${field} is not a valid name: "${value}"`);
  }
  return text;
}

function optionalRef(
  value: string | null | undefined,
  field: string,
): string | null {
  const text = value?.trim();
  return text ? ref(text, field) : null;
}

const REPO_HOSTS = ['github.com', 'bitbucket.org'];

/**
 * El enlace de un repositorio: https, solo github.com o bitbucket.org, sin credenciales ni puerto, con la forma
 * `https://host/org/repo`. No tiene que coincidir con el nombre del proyecto: al migrar de proveedor el repositorio puede
 * cambiar de organización. Lo que llega a un clone no puede traer opciones de git ni credenciales.
 */
function repoLink(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new DomainError('The repository link is not a valid URL');
  }
  const path = url.pathname.replace(/^\/|\/$|\.git$/g, '');
  if (
    url.protocol !== 'https:' ||
    !REPO_HOSTS.includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !/^[\w.-]+\/[\w.-]+$/.test(path)
  ) {
    throw new DomainError(
      'The repository link must be https://github.com/<organization>/<repository> or https://bitbucket.org/<organization>/<repository>',
    );
  }
  return `https://${url.hostname}/${path}`;
}

type Normalized = Omit<ProjectProps, 'id' | 'createdAt' | 'updatedAt'>;

function normalized(input: Required<ProjectInput>): Normalized {
  const repo = repoName(input.repo, 'The repository');
  const content = input.content.trim();
  if (content.length > MAX_RECIPE_CONTENT) {
    throw new DomainError(
      `The recipe cannot exceed ${MAX_RECIPE_CONTENT} characters`,
    );
  }
  const dependsOn = [
    ...new Set(input.dependsOn.map((name) => repoName(name, 'A dependency'))),
  ];
  if (dependsOn.includes(repo)) {
    throw new DomainError('A project cannot depend on its own repository');
  }
  if (dependsOn.length > MAX_RECIPE_DEPENDENCIES) {
    throw new DomainError(
      `A project can depend on at most ${MAX_RECIPE_DEPENDENCIES} repositories`,
    );
  }
  const name = input.name?.trim() || repo.split('/')[1];
  if (name.length > MAX_PROJECT_NAME) {
    throw new DomainError(
      `The project name cannot exceed ${MAX_PROJECT_NAME} characters`,
    );
  }
  const architectureRules = input.architectureRules.trim();
  if (architectureRules.length > MAX_ARCHITECTURE_RULES) {
    throw new DomainError(
      `The architecture rules cannot exceed ${MAX_ARCHITECTURE_RULES} characters`,
    );
  }
  const verifyCommand = input.verifyCommand?.trim() || null;
  if (
    verifyCommand !== null &&
    (verifyCommand.length > MAX_VERIFY_COMMAND || /[\r\n]/.test(verifyCommand))
  ) {
    throw new DomainError(
      `The verify command must be one line of at most ${MAX_VERIFY_COMMAND} characters`,
    );
  }
  return {
    repo,
    name,
    content,
    dependsOn,
    repoUrl: repoLink(input.repoUrl),
    mainBranch: ref(input.mainBranch, 'The main branch'),
    runnerEnvironment: optionalRef(
      input.runnerEnvironment,
      'The runner environment',
    ),
    architectureRules,
    verifyCommand,
  };
}

/**
 * Un proyecto: un repositorio con su receta (cómo se levanta y se prueba), sus dependencias de otros proyectos,
 * su rama principal y sus reglas. Uno por repositorio.
 */
export class Project {
  private constructor(private props: ProjectProps) {}

  static create(input: ProjectInput): Project {
    const now = new Date();
    return new Project({
      id: randomUUID(),
      ...normalized({
        dependsOn: [],
        name: null,
        repoUrl: null,
        mainBranch: DEFAULT_MAIN_BRANCH,
        runnerEnvironment: null,
        architectureRules: '',
        verifyCommand: null,
        ...input,
      }),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: ProjectProps): Project {
    return new Project({ ...props });
  }

  /** Cambia lo que venga; el repositorio no cambia (otro repositorio es otro proyecto). */
  update(changes: Partial<Omit<ProjectInput, 'repo'>>): void {
    const next = normalized({
      repo: this.props.repo,
      content: changes.content ?? this.props.content,
      dependsOn: changes.dependsOn ?? this.props.dependsOn,
      name: changes.name === undefined ? this.props.name : changes.name,
      repoUrl:
        changes.repoUrl === undefined ? this.props.repoUrl : changes.repoUrl,
      mainBranch: changes.mainBranch ?? this.props.mainBranch,
      runnerEnvironment:
        changes.runnerEnvironment === undefined
          ? this.props.runnerEnvironment
          : changes.runnerEnvironment,
      architectureRules:
        changes.architectureRules ?? this.props.architectureRules,
      verifyCommand:
        changes.verifyCommand === undefined
          ? this.props.verifyCommand
          : changes.verifyCommand,
    });
    this.props = { ...this.props, ...next, updatedAt: new Date() };
  }

  get id(): string {
    return this.props.id;
  }
  get repo(): string {
    return this.props.repo;
  }
  get name(): string {
    return this.props.name;
  }
  get content(): string {
    return this.props.content;
  }
  get dependsOn(): readonly string[] {
    return this.props.dependsOn;
  }
  get repoUrl(): string | null {
    return this.props.repoUrl;
  }
  get mainBranch(): string {
    return this.props.mainBranch;
  }
  get runnerEnvironment(): string | null {
    return this.props.runnerEnvironment;
  }
  get architectureRules(): string {
    return this.props.architectureRules;
  }
  get verifyCommand(): string | null {
    return this.props.verifyCommand;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
