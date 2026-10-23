import { RunnerProps } from './runner.props';

/** Un runner sin señal por más de esto se considera desconectado. */
export const RUNNER_ONLINE_MS = 60_000;

export class Runner {
  private constructor(private props: RunnerProps) {}

  static create(data: { name: string; tokenHash: string }): Runner {
    return new Runner({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      tokenHash: data.tokenHash,
      version: null,
      host: null,
      lastSeenAt: null,
      createdAt: new Date(),
    });
  }

  static reconstruct(props: RunnerProps): Runner {
    return new Runner(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get version(): string | null {
    return this.props.version;
  }
  get host(): string | null {
    return this.props.host;
  }
  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  isOnline(now = new Date()): boolean {
    return (
      this.props.lastSeenAt !== null &&
      now.getTime() - this.props.lastSeenAt.getTime() < RUNNER_ONLINE_MS
    );
  }

  introduce(info: { version?: string; host?: string }): void {
    this.props.version = info.version?.slice(0, 40) ?? this.props.version;
    this.props.host = info.host?.slice(0, 120) ?? this.props.host;
    this.props.lastSeenAt = new Date();
  }

  toProps(): RunnerProps {
    return this.props;
  }
}
