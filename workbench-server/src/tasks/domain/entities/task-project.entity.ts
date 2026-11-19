import { DomainError } from '@core/domain/domain.error';
import { TaskProjectProps } from './task-project.props';

const MAX_DEFAULT_REPOS = 3;
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/** Los repositorios por defecto: `organización/repo` en minúsculas, sin repetir y no más de los que admite una tarea. */
function normalizeRepos(repos: readonly string[]): string[] {
  const normalized = [
    ...new Set(repos.map((repo) => repo.trim().toLowerCase())),
  ];
  if (normalized.length > MAX_DEFAULT_REPOS) {
    throw new DomainError(
      `A task project can have at most ${MAX_DEFAULT_REPOS} default projects`,
    );
  }
  const invalid = normalized.find((repo) => !REPO_PATTERN.test(repo));
  if (invalid !== undefined) {
    throw new DomainError(
      `A project must look like "organization/repository", got "${invalid}"`,
    );
  }
  return normalized;
}

export class TaskProject {
  private constructor(private props: TaskProjectProps) {
    this.validateName();
    this.validateIdentity();
  }

  static createLocal(data: Pick<TaskProjectProps, 'name'>): TaskProject {
    return new TaskProject({
      ...data,
      id: crypto.randomUUID(),
      externalId: null,
      source: null,
      identifier: null,
      // El sync solo aplica a los proyectos de Plane.
      syncEnabled: false,
      visible: true,
      defaultProjectRepos: [],
      syncedAt: null,
      createdAt: new Date(),
    });
  }

  static createFromExternal(
    data: Pick<
      TaskProjectProps,
      'name' | 'externalId' | 'source' | 'identifier'
    >,
  ): TaskProject {
    return new TaskProject({
      ...data,
      syncEnabled: true,
      visible: true,
      defaultProjectRepos: [],
      id: crypto.randomUUID(),
      syncedAt: new Date(),
      createdAt: new Date(),
    });
  }

  static reconstruct(props: TaskProjectProps): TaskProject {
    return new TaskProject(props);
  }

  private validateName() {
    if (!this.props.name || this.props.name.trim() === '') {
      throw new DomainError('Project name cannot be empty');
    }
  }

  private validateIdentity() {
    const hasExternalId = this.props.externalId !== null;
    const hasSource = this.props.source !== null;

    if (hasExternalId !== hasSource) {
      throw new DomainError(
        'A project must have both externalId and source, or neither',
      );
    }
  }

  get id() {
    return this.props.id;
  }

  get name() {
    return this.props.name;
  }

  get externalId() {
    return this.props.externalId;
  }

  get identifier() {
    return this.props.identifier;
  }

  get syncEnabled() {
    return this.props.syncEnabled;
  }

  get visible() {
    return this.props.visible;
  }

  get defaultProjectRepos() {
    return [...this.props.defaultProjectRepos];
  }

  get source() {
    return this.props.source;
  }

  get syncedAt() {
    return this.props.syncedAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get isLocal() {
    return this.props.source === null;
  }

  // Edición manual: los proyectos de Plane solo cambian con el sync.
  rename(name: string) {
    this.assertLocal('edited');
    this.applyName(name);
  }

  /**
   * Los proyectos de Plane no se editan, salvo estas dos opciones: si se sincronizan y si se ven.
   * Sincronizar solo tiene sentido en los de Plane.
   */
  configure(options: {
    syncEnabled?: boolean;
    visible?: boolean;
    defaultProjectRepos?: readonly string[];
  }) {
    if (options.defaultProjectRepos !== undefined) {
      this.props.defaultProjectRepos = normalizeRepos(
        options.defaultProjectRepos,
      );
    }
    if (options.syncEnabled !== undefined) {
      if (this.isLocal) {
        throw new DomainError('Only Plane projects can be synchronized');
      }
      this.props.syncEnabled = options.syncEnabled;
    }
    if (options.visible !== undefined) {
      this.props.visible = options.visible;
    }
  }

  assertDeletable() {
    this.assertLocal('deleted');
  }

  syncFromRemote(name: string, identifier: string | null) {
    this.applyName(name);
    this.props.identifier = identifier;
    this.props.syncedAt = new Date();
  }

  private applyName(name: string) {
    const previous = this.props.name;
    this.props.name = name;
    try {
      this.validateName();
    } catch (e) {
      this.props.name = previous;
      throw e;
    }
  }

  private assertLocal(action: string) {
    if (!this.isLocal) {
      throw new DomainError(
        `A Plane project cannot be ${action} here: it only changes with the sync`,
      );
    }
  }
}
