import { DomainError } from '@core/domain/domain.error';
import { ProjectProps } from './project.props';

export class Project {
  private constructor(private props: ProjectProps) {
    this.validateName();
    this.validateIdentity();
  }

  static createLocal(data: Pick<ProjectProps, 'name'>): Project {
    return new Project({
      ...data,
      id: crypto.randomUUID(),
      externalId: null,
      source: null,
      identifier: null,
      // El sync solo aplica a los proyectos de Plane.
      syncEnabled: false,
      visible: true,
      syncedAt: null,
      createdAt: new Date(),
    });
  }

  static createFromExternal(
    data: Pick<ProjectProps, 'name' | 'externalId' | 'source' | 'identifier'>,
  ): Project {
    return new Project({
      ...data,
      syncEnabled: true,
      visible: true,
      id: crypto.randomUUID(),
      syncedAt: new Date(),
      createdAt: new Date(),
    });
  }

  static reconstruct(props: ProjectProps): Project {
    return new Project(props);
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
  configure(options: { syncEnabled?: boolean; visible?: boolean }) {
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
