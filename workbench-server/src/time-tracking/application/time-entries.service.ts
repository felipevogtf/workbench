import { Inject, Injectable } from '@nestjs/common';
import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';
import {
  TIME_ENTRY_REPOSITORY_PORT,
  type TimeEntryRepositoryPort,
} from '@time-tracking/domain/ports/time-entry-repository.port';

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
  ) {}

  async addTimeEntry(data: AddTimeEntryData) {
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

  async deleteTimeEntry(id: string): Promise<void> {
    const timeEntry = await this.repo.findById(id);

    if (!timeEntry) {
      throw new Error(`Time entry with id ${id} not found`);
    }

    await this.repo.delete(id);
  }
}
