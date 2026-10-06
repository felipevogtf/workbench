import { CommentStatus, ReviewProps, ReviewTicket } from './review.props';

export class Review {
  private constructor(private props: ReviewProps) {}

  /** Revisión terminada: el comentario en la PR queda pendiente de publicarse. */
  static createSucceeded(data: {
    pullRequestId: string;
    commit: string;
    agentId: string;
    agentName: string;
    model: string;
    docPath: string;
    tickets: ReviewTicket[];
  }): Review {
    return new Review({
      id: crypto.randomUUID(),
      ...data,
      status: 'ok',
      error: null,
      commentStatus: 'pending',
      commentUrl: null,
      commentError: null,
      createdAt: new Date(),
    });
  }

  /** Intento fallido: se registra igual para tener historial de errores. */
  static createFailed(data: {
    pullRequestId: string;
    commit: string | null;
    agentId: string | null;
    agentName: string | null;
    model: string | null;
    error: string;
    tickets?: ReviewTicket[];
  }): Review {
    return new Review({
      id: crypto.randomUUID(),
      ...data,
      tickets: data.tickets ?? [],
      docPath: null,
      status: 'failed',
      commentStatus: 'failed',
      commentUrl: null,
      commentError: 'No review to comment',
      createdAt: new Date(),
    });
  }

  static reconstruct(props: ReviewProps): Review {
    return new Review(props);
  }

  markCommentPosted(url: string): void {
    this.props.commentStatus = 'posted';
    this.props.commentUrl = url;
    this.props.commentError = null;
  }

  markCommentFailed(error: string): void {
    this.props.commentStatus = 'failed';
    this.props.commentError = error;
  }

  get id(): string {
    return this.props.id;
  }

  get pullRequestId(): string {
    return this.props.pullRequestId;
  }

  get commit(): string | null {
    return this.props.commit;
  }

  get agentId(): string | null {
    return this.props.agentId;
  }

  get agentName(): string | null {
    return this.props.agentName;
  }

  get model(): string | null {
    return this.props.model;
  }

  get docPath(): string | null {
    return this.props.docPath;
  }

  get status() {
    return this.props.status;
  }

  get error(): string | null {
    return this.props.error;
  }

  get commentStatus(): CommentStatus {
    return this.props.commentStatus;
  }

  get commentUrl(): string | null {
    return this.props.commentUrl;
  }

  get commentError(): string | null {
    return this.props.commentError;
  }

  get tickets(): ReviewTicket[] {
    return this.props.tickets;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
