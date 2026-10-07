import { DomainError } from '@core/domain/domain.error';
import { LabelProps } from './label.props';
import { normalizeRepoUrl } from '@tasks/domain/repo-url';

export class Label {
  private constructor(private props: LabelProps) {
    this.validateName();
  }

  static create(data: {
    name: string;
    color?: string | null;
    repoUrl?: string | null;
  }): Label {
    return new Label({
      id: crypto.randomUUID(),
      name: data.name,
      color: data.color ?? null,
      repoUrl: data.repoUrl ? normalizeRepoUrl(data.repoUrl) : null,
    });
  }

  static reconstruct(props: LabelProps): Label {
    return new Label(props);
  }

  private validateName(): void {
    if (!this.props.name.trim()) {
      throw new DomainError('Label name cannot be empty');
    }
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get repoUrl(): string | null {
    return this.props.repoUrl;
  }

  get color(): string | null {
    return this.props.color;
  }

  rename(name: string): void {
    const previous = this.props.name;
    this.props.name = name;
    try {
      this.validateName();
    } catch (e) {
      this.props.name = previous;
      throw e;
    }
  }

  /** Vacío quita el repositorio; si no, se valida y se normaliza. */
  setRepoUrl(repoUrl: string | null): void {
    this.props.repoUrl = repoUrl?.trim() ? normalizeRepoUrl(repoUrl) : null;
  }

  recolor(color: string | null): void {
    this.props.color = color;
  }
}
