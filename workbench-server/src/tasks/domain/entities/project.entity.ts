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
      syncedAt: null,
      createdAt: new Date(),
    });
  }

  static createFromExternal(
    data: Pick<ProjectProps, 'name' | 'externalId' | 'source'>,
  ): Project {
    return new Project({
      ...data,
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
      throw new Error('Project name cannot be empty');
    }
  }

  private validateIdentity() {
    const hasExternalId = this.props.externalId !== null;
    const hasSource = this.props.source !== null;

    if (hasExternalId !== hasSource) {
      throw new Error(
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

  get source() {
    return this.props.source;
  }

  get syncedAt() {
    return this.props.syncedAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  rename(name: string) {
    const previous = this.props.name;
    this.props.name = name;
    try {
      this.validateName();
    } catch (e) {
      this.props.name = previous;
      throw e;
    }
  }

  markAsSynced() {
    this.props.syncedAt = new Date();
  }
}
