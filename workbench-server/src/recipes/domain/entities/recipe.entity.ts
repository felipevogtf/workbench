import { randomUUID } from 'node:crypto';
import { DomainError } from '@core/domain/domain.error';

/** `organización/repo`, como lo escribe el usuario y como lo conoce el resto de la app. */
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export const MAX_RECIPE_CONTENT = 20_000;
export const MAX_RECIPE_DEPENDENCIES = 10;

export interface RecipeProps {
  id: string;
  repo: string;
  content: string;
  /** Otros repositorios que hay que tener a mano para probar este (ej. la web de la que depende la app). */
  dependsOn: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeInput {
  repo: string;
  content: string;
  dependsOn?: readonly string[];
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

function normalized(input: RecipeInput): {
  repo: string;
  content: string;
  dependsOn: string[];
} {
  const repo = repoName(input.repo, 'The repository');
  const content = input.content.trim();
  if (content.length > MAX_RECIPE_CONTENT) {
    throw new DomainError(
      `The recipe cannot exceed ${MAX_RECIPE_CONTENT} characters`,
    );
  }
  const dependsOn = [
    ...new Set(
      (input.dependsOn ?? []).map((name) => repoName(name, 'A dependency')),
    ),
  ];
  if (dependsOn.includes(repo)) {
    throw new DomainError('A recipe cannot depend on its own repository');
  }
  if (dependsOn.length > MAX_RECIPE_DEPENDENCIES) {
    throw new DomainError(
      `A recipe can depend on at most ${MAX_RECIPE_DEPENDENCIES} repositories`,
    );
  }
  return { repo, content, dependsOn };
}

/**
 * La receta de un proyecto: un texto (Markdown) que explica cómo se levanta y se prueba ese repositorio, para
 * que los agentes lo sepan. Una por repositorio.
 */
export class Recipe {
  private constructor(private props: RecipeProps) {}

  static create(input: RecipeInput): Recipe {
    const now = new Date();
    return new Recipe({
      id: randomUUID(),
      ...normalized(input),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: RecipeProps): Recipe {
    return new Recipe({ ...props });
  }

  /** Cambia lo que venga; el repositorio no cambia (otro repositorio es otra receta). */
  update(changes: { content?: string; dependsOn?: readonly string[] }): void {
    const next = normalized({
      repo: this.props.repo,
      content: changes.content ?? this.props.content,
      dependsOn: changes.dependsOn ?? this.props.dependsOn,
    });
    this.props = { ...this.props, ...next, updatedAt: new Date() };
  }

  get id(): string {
    return this.props.id;
  }
  get repo(): string {
    return this.props.repo;
  }
  get content(): string {
    return this.props.content;
  }
  get dependsOn(): readonly string[] {
    return this.props.dependsOn;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
