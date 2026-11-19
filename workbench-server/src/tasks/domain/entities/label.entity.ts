import { DomainError } from '@core/domain/domain.error';
import { LabelProps } from './label.props';
import { randomLabelColor } from '@tasks/domain/label-colors';

export class Label {
  private constructor(private props: LabelProps) {
    this.validateName();
  }

  static create(data: {
    name: string;
    color?: string | null;
    projectRepo?: string | null;
  }): Label {
    return new Label({
      id: crypto.randomUUID(),
      name: data.name,
      // Sin color se elige uno al azar de la paleta, para que ninguna etiqueta quede sin distinguirse.
      color: data.color ?? randomLabelColor(),
      projectRepo: normalizeProjectRepo(data.projectRepo),
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
  get projectRepo(): string | null {
    return this.props.projectRepo;
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

  /** Vacío quita el proyecto; si no, se valida (`org/repo`) y se normaliza. */
  setProjectRepo(projectRepo: string | null): void {
    this.props.projectRepo = normalizeProjectRepo(projectRepo);
  }

  recolor(color: string | null): void {
    this.props.color = color;
  }
}

const PROJECT_REPO = /^[\w.-]+\/[\w.-]+$/;

function normalizeProjectRepo(value: string | null | undefined): string | null {
  const text = value?.trim().toLowerCase();
  if (!text) return null;
  if (!PROJECT_REPO.test(text)) {
    throw new DomainError(
      'The project must look like <organization>/<repository>',
    );
  }
  return text;
}
