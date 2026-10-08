import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TimeEntryRepositoryPort } from '@time-tracking/domain/ports/time-entry-repository.port';
import { Repository } from 'typeorm';
import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';
import { TimeEntryOrmEntity } from '@time-tracking/infrastructure/persistence/time-entry.orm-entity';

@Injectable()
export class TypeOrmTimeEntryRepository implements TimeEntryRepositoryPort {
  constructor(
    @InjectRepository(TimeEntryOrmEntity)
    private readonly timeEntryRepository: Repository<TimeEntryOrmEntity>,
  ) {}

  async findById(id: string): Promise<TimeEntry | null> {
    const orm = await this.timeEntryRepository.findOne({
      where: { id },
    });

    return orm ? this.toDomain(orm) : null;
  }

  async findByIssueId(issueId: string): Promise<TimeEntry[]> {
    const rows = await this.timeEntryRepository.find({
      where: { issue_id: issueId },
      order: { date: 'DESC' },
    });

    return rows.map((orm) => this.toDomain(orm));
  }

  async save(timeEntry: TimeEntry): Promise<TimeEntry> {
    const savedOrm = await this.timeEntryRepository.save({
      id: timeEntry.id,
      issue_id: timeEntry.issueId,
      hours: timeEntry.hours,
      date: timeEntry.date,
    });

    return this.toDomain(savedOrm);
  }

  async delete(id: string): Promise<void> {
    await this.timeEntryRepository.delete(id);
  }

  async moveToIssue(fromIssueId: string, toIssueId: string): Promise<number> {
    const result = await this.timeEntryRepository.update(
      { issue_id: fromIssueId },
      { issue_id: toIssueId },
    );
    return result.affected ?? 0;
  }

  async sumHoursByIssueId(issueId: string): Promise<number> {
    const result = await this.timeEntryRepository
      .createQueryBuilder('time_entry')
      .select('SUM(time_entry.hours)', 'total')
      .where('time_entry.issue_id = :issueId', { issueId })
      .getRawOne<{ total: string | null }>();

    return Number(result?.total ?? 0);
  }

  private toDomain(orm: TimeEntryOrmEntity): TimeEntry {
    return TimeEntry.reconstruct({
      id: orm.id,
      issueId: orm.issue_id,
      hours: Number(orm.hours),
      date: orm.date,
      createdAt: orm.created_at,
    });
  }
}
