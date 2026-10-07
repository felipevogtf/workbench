import { DomainError } from '@core/domain/domain.error';
// tasks/domain/entities/state.entity.ts
import { StateProps } from './state.props';

export class State {
  private constructor(private props: StateProps) {
    this.validateName();
  }

  static create(data: {
    name: string;
    color?: string | null;
    position: number;
    isFinal?: boolean;
  }): State {
    return new State({
      id: crypto.randomUUID(),
      name: data.name,
      color: data.color ?? null,
      position: data.position,
      isFinal: data.isFinal ?? false,
    });
  }

  static reconstruct(props: StateProps): State {
    return new State(props);
  }

  private validateName(): void {
    if (!this.props.name.trim()) {
      throw new DomainError('State name cannot be empty');
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
  get position(): number {
    return this.props.position;
  }
  get isFinal(): boolean {
    return this.props.isFinal;
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

  moveTo(position: number): void {
    if (position < 0) throw new DomainError('Position cannot be negative');
    this.props.position = position;
  }

  markFinal(isFinal: boolean): void {
    this.props.isFinal = isFinal;
  }

  recolor(color: string | null): void {
    this.props.color = color;
  }
}
