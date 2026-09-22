import { BoardIssueProps } from './board-issue.props';

export class BoardIssue {
  private constructor(private props: BoardIssueProps) {}

  static create(data: {
    boardId: string;
    issueId: string;
    position: number;
  }): BoardIssue {
    return new BoardIssue({
      id: crypto.randomUUID(),
      boardId: data.boardId,
      issueId: data.issueId,
      position: data.position,
      createdAt: new Date(),
    });
  }

  static reconstruct(props: BoardIssueProps): BoardIssue {
    return new BoardIssue(props);
  }

  get id(): string {
    return this.props.id;
  }

  get boardId(): string {
    return this.props.boardId;
  }

  get issueId(): string {
    return this.props.issueId;
  }

  get position(): number {
    return this.props.position;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  reposition(newPosition: number): void {
    if (newPosition < 0) {
      throw new Error('Position cannot be negative');
    }
    this.props.position = newPosition;
  }
}
