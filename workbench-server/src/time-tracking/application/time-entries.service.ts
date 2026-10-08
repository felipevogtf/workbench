import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable } from '@nestjs/common';
import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';
import {
  buildTimeReport,
  validateReportRange,
  type TimeReport,
} from '@time-tracking/domain/time-report';
import {
  TIME_ENTRY_REPOSITORY_PORT,
  type TimeEntryRepositoryPort,
} from '@time-tracking/domain/ports/time-entry-repository.port';
import {
  ISSUE_EXISTS_PORT,
  type IssueExistsPort,
} from '@time-tracking/domain/ports/issue-exists.port';
import {
  ISSUE_ORIGIN_PORT,
  type IssueOriginPort,
} from '@time-tracking/domain/ports/issue-origin.port';

interface AddTimeEntryData {
  issueId: string;
  hours: number;
  date: string;
}

@Injectable()
export class TimeEntriesService {
  constructor(
    @Inject(TIME_ENTRY_REPOSITORY_PORT)
    private readonly repo: TimeEntryRepositoryPort,
    @Inject(ISSUE_EXISTS_PORT)
    private readonly issueExists: IssueExistsPort,
    @Inject(ISSUE_ORIGIN_PORT)
    private readonly issueOrigin: IssueOriginPort,
  ) {}

  async addTimeEntry(data: AddTimeEntryData) {
    if (!(await this.issueExists.exists(data.issueId))) {
      throw DomainError.notFound(`Issue with id ${data.issueId} not found`);
    }

    const timeEntry = TimeEntry.create({
      issueId: data.issueId,
      hours: data.hours,
      date: data.date,
    });

    await this.repo.save(timeEntry);
    return timeEntry;
  }

  async findByIssue(issueId: string): Promise<TimeEntry[]> {
    return this.repo.findByIssueId(issueId);
  }

  async getTotalHoursByIssue(issueId: string): Promise<number> {
    return this.repo.sumHoursByIssueId(issueId);
  }

  /**
   * Horas registradas entre dos fechas (incluidas), por día y por tarea. Con `includeLocal: false`
   * no cuentan las horas de las tareas locales (solo las de tareas que vienen de Plane).
   */
  async getReport(
    from: string,
    to: string,
    { includeLocal = true }: { includeLocal?: boolean } = {},
  ): Promise<TimeReport> {
    validateReportRange(from, to);

    let entries = await this.repo.findBetweenDates(from, to);
    if (!includeLocal) {
      const local = await this.issueOrigin.findLocalIds([
        ...new Set(entries.map((entry) => entry.issueId)),
      ]);
      entries = entries.filter((entry) => !local.has(entry.issueId));
    }
    return buildTimeReport(from, to, entries);
  }

  /** Horas registradas por tarea (id → horas); las tareas sin horas no aparecen. */
  async getTotalsByIssue(): Promise<Record<string, number>> {
    return this.repo.sumHoursGroupedByIssue();
  }

  /** Pasa todas las horas de una tarea a otra (la de destino debe existir). */
  async moveEntries(fromIssueId: string, toIssueId: string): Promise<number> {
    if (!(await this.issueExists.exists(toIssueId))) {
      throw DomainError.notFound(`Issue with id ${toIssueId} not found`);
    }
    return this.repo.moveToIssue(fromIssueId, toIssueId);
  }

  async deleteTimeEntry(id: string): Promise<void> {
    const timeEntry = await this.repo.findById(id);

    if (!timeEntry) {
      throw DomainError.notFound(`Time entry with id ${id} not found`);
    }

    await this.repo.delete(id);
  }
}
