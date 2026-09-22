import { BoardProps } from './board.props';

export class Board {
  private constructor(private props: BoardProps) {
    this.validateName();
  }

  static create(data: { name: string; description: string | null }): Board {
    return new Board({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      createdAt: new Date(),
    });
  }

  static reconstruct(props: BoardProps): Board {
    return new Board(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  private validateName(): void {
    if (!this.props.name || this.props.name.trim() === '') {
      throw new Error('Name is required');
    }
  }

  rename(name: string): void {
    if (!name || name.trim() === '') {
      throw new Error('New name is required');
    }
    this.props.name = name;
  }

  updateDescription(newDescription: string | null): void {
    this.props.description = newDescription;
  }
}
