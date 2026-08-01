import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';

export interface TimeEntryRepositoryPort {
  findById(id: string): Promise<TimeEntry | null>;
  findByIssueId(issueId: string): Promise<TimeEntry[]>;
  save(timeEntry: TimeEntry): Promise<TimeEntry>;
  delete(id: string): Promise<void>;
  sumHoursByIssueId(issueId: string): Promise<number>;
}

export const TIME_ENTRY_REPOSITORY_PORT = Symbol('TIME_ENTRY_REPOSITORY_PORT');
