import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';

export interface TimeEntryRepositoryPort {
  findById(id: string): Promise<TimeEntry | null>;
  findByIssueId(issueId: string): Promise<TimeEntry[]>;
  save(timeEntry: TimeEntry): Promise<TimeEntry>;
  delete(id: string): Promise<void>;
  /** Reasigna todas las horas de una tarea a otra. Devuelve cuántos registros se movieron. */
  moveToIssue(fromIssueId: string, toIssueId: string): Promise<number>;
  sumHoursByIssueId(issueId: string): Promise<number>;
  /** Entradas con fecha entre `from` y `to` (`YYYY-MM-DD`, ambas incluidas). */
  findBetweenDates(from: string, to: string): Promise<TimeEntry[]>;
  /** Horas registradas por tarea, solo de las que tienen alguna. */
  sumHoursGroupedByIssue(): Promise<Record<string, number>>;
}

export const TIME_ENTRY_REPOSITORY_PORT = Symbol('TIME_ENTRY_REPOSITORY_PORT');
