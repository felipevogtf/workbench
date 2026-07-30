import { ProjectProps } from './project.props';

export class Project {
  private constructor(private props: ProjectProps) {
    this.validateName();
  }

  static createFromExternal(
    data: Pick<ProjectProps, 'name' | 'externalId'>,
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

  get id() {
    return this.props.id;
  }

  get name() {
    return this.props.name;
  }

  get externalId() {
    return this.props.externalId;
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
