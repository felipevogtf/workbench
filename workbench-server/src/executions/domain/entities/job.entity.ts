import { DomainError } from '@core/domain/domain.error';
import {
  JobKind,
  JobPayload,
  JobProps,
  JobResult,
  JobStatus,
} from './job.props';
import type { JobUsage } from './../usage';

/** Tope del registro que se guarda por trabajo; lo más viejo se descarta. */
export const MAX_LOG_CHARS = 200_000;

export class Job {
  private constructor(private props: JobProps) {}

  static create(data: {
    executionId: string;
    kind: JobKind;
    ticketId?: string | null;
    payload: JobPayload;
    attempt?: number;
  }): Job {
    const now = new Date();
    return new Job({
      id: crypto.randomUUID(),
      executionId: data.executionId,
      kind: data.kind,
      ticketId: data.ticketId ?? null,
      status: 'pending',
      payload: data.payload,
      result: null,
      logs: '',
      error: null,
      runnerId: null,
      attempt: data.attempt ?? 1,
      costUsd: null,
      usage: null,
      queuedAt: now,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: JobProps): Job {
    return new Job(props);
  }

  get id(): string {
    return this.props.id;
  }
  get executionId(): string {
    return this.props.executionId;
  }
  get kind(): JobKind {
    return this.props.kind;
  }
  get ticketId(): string | null {
    return this.props.ticketId;
  }
  get status(): JobStatus {
    return this.props.status;
  }
  get payload(): JobPayload {
    return this.props.payload;
  }
  get result(): JobResult | null {
    return this.props.result;
  }
  get logs(): string {
    return this.props.logs;
  }
  get error(): string | null {
    return this.props.error;
  }
  get runnerId(): string | null {
    return this.props.runnerId;
  }
  get attempt(): number {
    return this.props.attempt;
  }
  get costUsd(): number | null {
    return this.props.costUsd;
  }
  get usage(): JobUsage | null {
    return this.props.usage;
  }
  get queuedAt(): Date {
    return this.props.queuedAt;
  }
  get startedAt(): Date | null {
    return this.props.startedAt;
  }
  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }
  get isOpen(): boolean {
    return this.props.status === 'pending' || this.props.status === 'running';
  }

  toProps(): JobProps {
    return this.props;
  }

  appendLogs(text: string): void {
    if (!text) return;
    const joined = this.props.logs + text;
    this.props.logs =
      joined.length > MAX_LOG_CHARS ? joined.slice(-MAX_LOG_CHARS) : joined;
    this.touch();
  }

  complete(
    result: JobResult,
    costUsd: number | null,
    usage: JobUsage | null = null,
  ): void {
    this.assertRunning();
    this.props.status = 'done';
    this.props.result = result;
    this.props.costUsd = costUsd;
    this.props.usage = usage;
    this.props.error = null;
    this.props.finishedAt = new Date();
    this.touch();
  }

  fail(
    message: string,
    costUsd: number | null = null,
    usage: JobUsage | null = null,
  ): void {
    this.assertRunning();
    this.props.status = 'failed';
    this.props.error = message.slice(0, 2000);
    this.props.costUsd = costUsd;
    this.props.usage = usage;
    this.props.finishedAt = new Date();
    this.touch();
  }

  cancel(): void {
    if (!this.isOpen) return;
    this.props.status = 'cancelled';
    this.props.finishedAt = new Date();
    this.touch();
  }

  private assertRunning(): void {
    if (this.props.status !== 'running') {
      throw DomainError.conflict(
        `A job in status ${this.props.status} cannot be finished`,
      );
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
