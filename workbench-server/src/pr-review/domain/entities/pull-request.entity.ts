import { DomainError } from '@core/domain/domain.error';
import {
  GitProvider,
  PullRequestProps,
  PullRequestState,
  PullRequestStatus,
} from './pull-request.props';

export interface PullRequestRemoteData {
  provider: GitProvider;
  repo: string;
  externalId: string;
  url: string;
  title: string;
  author: string;
  sourceBranch: string;
  destBranch: string;
  headCommit: string;
  description: string | null;
}

export class PullRequest {
  private constructor(private props: PullRequestProps) {}

  /** Una PR nueva entra a la cola de revisión (pending). */
  static createFromRemote(data: PullRequestRemoteData): PullRequest {
    const now = new Date();
    return new PullRequest({
      id: crypto.randomUUID(),
      ...data,
      ticketKeys: [],
      state: 'open',
      status: 'pending',
      queuedAt: now,
      requestedAgentId: null,
      requestedModel: null,
      lastReviewedAt: null,
      reviewDocUrl: null,
      reviewedCommit: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: PullRequestProps): PullRequest {
    return new PullRequest(props);
  }

  /**
   * Actualiza los datos que vienen del provider. No toca `status`: si llega un
   * commit nuevo la PR queda desactualizada (isStale) pero no se revisa sola.
   */
  syncFromRemote(
    data: Pick<
      PullRequestRemoteData,
      | 'url'
      | 'title'
      | 'author'
      | 'sourceBranch'
      | 'destBranch'
      | 'headCommit'
      | 'description'
    >,
  ): void {
    this.props.url = data.url;
    this.props.title = data.title;
    this.props.author = data.author;
    this.props.sourceBranch = data.sourceBranch;
    this.props.destBranch = data.destBranch;
    this.props.headCommit = data.headCommit;
    this.props.description = data.description;
    this.props.state = 'open';
    this.touch();
  }

  /** Actualiza los tickets detectados; solo toca la PR si cambiaron. */
  setTicketKeys(keys: readonly string[]): void {
    const same =
      keys.length === this.props.ticketKeys.length &&
      keys.every((key, index) => key === this.props.ticketKeys[index]);
    if (same) return;

    this.props.ticketKeys = [...keys];
    this.touch();
  }

  /**
   * Re-revisión manual: vuelve a la cola. Si ya estaba en cola solo actualiza el
   * override pedido, sin perder su lugar.
   */
  enqueue(override: { agentId?: string; model?: string } = {}): void {
    if (this.props.state === 'closed') {
      throw new DomainError('A closed pull request cannot be reviewed');
    }
    if (this.props.status === 'reviewing') {
      throw new DomainError(
        'The pull request is being reviewed right now',
        'conflict',
      );
    }

    this.props.requestedAgentId = override.agentId ?? null;
    this.props.requestedModel = override.model ?? null;

    if (this.props.status !== 'pending') {
      this.props.status = 'pending';
      this.props.queuedAt = new Date();
    }
    this.touch();
  }

  markReviewing(): void {
    if (this.props.status !== 'pending') {
      throw new DomainError(
        `Only a pending pull request can start reviewing (current: ${this.props.status})`,
        'conflict',
      );
    }
    this.props.status = 'reviewing';
    this.touch();
  }

  markReviewed(data: { commit: string; docPath: string }): void {
    this.props.status = 'reviewed';
    this.props.reviewedCommit = data.commit;
    // El checkout deja la rama en su último commit conocido.
    this.props.headCommit = data.commit;
    this.props.reviewDocUrl = data.docPath;
    this.props.lastReviewedAt = new Date();
    this.props.lastError = null;
    this.props.requestedAgentId = null;
    this.props.requestedModel = null;
    this.touch();
  }

  markFailed(error: string): void {
    this.props.status = 'failed';
    this.props.lastError = error;
    this.props.requestedAgentId = null;
    this.props.requestedModel = null;
    this.touch();
  }

  markClosed(): void {
    this.props.state = 'closed';
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /**
   * Hay commits que la última revisión no vio. Los commits se comparan por prefijo:
   * Bitbucket los entrega abreviados (12 caracteres) y git completos (40).
   */
  get isStale(): boolean {
    return (
      this.props.reviewedCommit !== null &&
      !PullRequest.sameCommit(this.props.headCommit, this.props.reviewedCommit)
    );
  }

  private static sameCommit(a: string, b: string): boolean {
    const length = Math.min(a.length, b.length);
    return length > 0 && a.slice(0, length) === b.slice(0, length);
  }

  get id(): string {
    return this.props.id;
  }

  get provider(): GitProvider {
    return this.props.provider;
  }

  get repo(): string {
    return this.props.repo;
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get url(): string {
    return this.props.url;
  }

  get title(): string {
    return this.props.title;
  }

  get author(): string {
    return this.props.author;
  }

  get sourceBranch(): string {
    return this.props.sourceBranch;
  }

  get destBranch(): string {
    return this.props.destBranch;
  }

  get headCommit(): string {
    return this.props.headCommit;
  }

  get description(): string | null {
    return this.props.description;
  }

  get ticketKeys(): string[] {
    return [...this.props.ticketKeys];
  }

  get state(): PullRequestState {
    return this.props.state;
  }

  get status(): PullRequestStatus {
    return this.props.status;
  }

  get queuedAt(): Date {
    return this.props.queuedAt;
  }

  get requestedAgentId(): string | null {
    return this.props.requestedAgentId;
  }

  get requestedModel(): string | null {
    return this.props.requestedModel;
  }

  get lastReviewedAt(): Date | null {
    return this.props.lastReviewedAt;
  }

  get reviewDocUrl(): string | null {
    return this.props.reviewDocUrl;
  }

  get reviewedCommit(): string | null {
    return this.props.reviewedCommit;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
