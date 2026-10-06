import { DomainError } from '@core/domain/domain.error';
import { LabelProps } from './label.props';

export class Label {
  private constructor(private props: LabelProps) {
    this.validateName();
  }

  static create(data: { name: string; color?: string | null }): Label {
    return new Label({
      id: crypto.randomUUID(),
      name: data.name,
      color: data.color ?? null,
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

  recolor(color: string | null): void {
    this.props.color = color;
  }
}
