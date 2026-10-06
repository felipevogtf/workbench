import { DomainError } from '@core/domain/domain.error';
import { TimeEntryProps } from './time-entry.props';

export class TimeEntry {
  private constructor(private props: TimeEntryProps) {
    this.validateHours();
  }

  static create(data: {
    issueId: string;
    hours: number;
    date: string;
  }): TimeEntry {
    return new TimeEntry({
      id: crypto.randomUUID(),
      issueId: data.issueId,
      hours: data.hours,
      date: data.date,
      createdAt: new Date(),
    });
  }

  static reconstruct(props: TimeEntryProps): TimeEntry {
    return new TimeEntry(props);
  }

  private validateHours(): void {
    if (this.props.hours <= 0) {
      throw new DomainError('Hours must be greater than zero');
    }

    if (this.props.hours > 24) {
      throw new DomainError('Hours cannot exceed 24');
    }
  }

  get id(): string {
    return this.props.id;
  }

  get issueId(): string {
    return this.props.issueId;
  }

  get hours(): number {
    return this.props.hours;
  }

  get date(): string {
    return this.props.date;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
