import { DomainError } from '@core/domain/domain.error';
import { PlanProps, PlanRepoInfo, PlanStatus } from './plan.props';

export class Plan {
  private constructor(private props: PlanProps) {}

  static create(data: {
    issueId: string;
    agentId?: string;
    model?: string;
  }): Plan {
    const now = new Date();
    return new Plan({
      id: crypto.randomUUID(),
      issueId: data.issueId,
      status: 'pending',
      content: null,
      requestedAgentId: data.agentId?.trim() || null,
      requestedModel: data.model?.trim() || null,
      agentId: null,
      agentName: null,
      model: null,
      repos: [],
      error: null,
      queuedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: PlanProps): Plan {
    return new Plan(props);
  }

  /** Lo toma un worker. */
  markGenerating(): void {
    if (this.props.status !== 'pending') {
      throw new DomainError(
        `A plan in status ${this.props.status} cannot start generating`,
        'conflict',
      );
    }
    this.props.status = 'generating';
    this.touch();
  }

  complete(result: {
    content: string;
    agentId: string;
    agentName: string;
    model: string;
    repos: PlanRepoInfo[];
  }): void {
    if (!result.content.trim()) {
      throw new DomainError('A plan cannot be empty');
    }
    this.props.status = 'ready';
    this.props.content = result.content;
    this.props.agentId = result.agentId;
    this.props.agentName = result.agentName;
    this.props.model = result.model;
    this.props.repos = result.repos;
    this.props.error = null;
    this.touch();
  }

  fail(message: string, repos: PlanRepoInfo[] = this.props.repos): void {
    this.props.status = 'failed';
    this.props.error = message.slice(0, 2000);
    this.props.repos = repos;
    this.touch();
  }

  /** En cola o generándose: no se puede borrar ni pedir otro para la misma tarea. */
  get isActive(): boolean {
    return (
      this.props.status === 'pending' || this.props.status === 'generating'
    );
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }
  get issueId(): string {
    return this.props.issueId;
  }
  get status(): PlanStatus {
    return this.props.status;
  }
  get content(): string | null {
    return this.props.content;
  }
  get requestedAgentId(): string | null {
    return this.props.requestedAgentId;
  }
  get requestedModel(): string | null {
    return this.props.requestedModel;
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
  get repos(): PlanRepoInfo[] {
    return [...this.props.repos];
  }
  get error(): string | null {
    return this.props.error;
  }
  get queuedAt(): Date {
    return this.props.queuedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
