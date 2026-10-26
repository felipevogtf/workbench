import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UsageLimits, UsageSnapshot } from '@executions/domain/usage';
import { UsageSnapshotRepositoryPort } from '@executions/domain/ports/usage-snapshot-repository.port';
import { UsageSnapshotOrmEntity } from '@executions/infrastructure/persistence/usage-snapshot.orm-entity';

@Injectable()
export class TypeOrmUsageSnapshotRepository implements UsageSnapshotRepositoryPort {
  constructor(
    @InjectRepository(UsageSnapshotOrmEntity)
    private readonly repository: Repository<UsageSnapshotOrmEntity>,
  ) {}

  async save(snapshot: UsageSnapshot): Promise<UsageSnapshot> {
    const { fiveHour, sevenDay } = snapshot.limits;
    const saved = await this.repository.save({
      id: snapshot.id,
      taken_at: snapshot.takenAt,
      five_hour_used: fiveHour?.used ?? null,
      five_hour_resets_at: fiveHour ? new Date(fiveHour.resetsAt) : null,
      seven_day_used: sevenDay?.used ?? null,
      seven_day_resets_at: sevenDay ? new Date(sevenDay.resetsAt) : null,
      source: snapshot.source,
      job_id: snapshot.jobId,
    });
    return this.toDomain(saved);
  }

  async findLatest(): Promise<UsageSnapshot | null> {
    const orm = await this.repository.findOne({
      where: {},
      order: { taken_at: 'DESC' },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findFirstAtOrAfter(date: Date): Promise<UsageSnapshot | null> {
    const orm = await this.repository.findOne({
      where: { taken_at: MoreThanOrEqual(date) },
      order: { taken_at: 'ASC' },
    });
    return orm ? this.toDomain(orm) : null;
  }

  private toDomain(orm: UsageSnapshotOrmEntity): UsageSnapshot {
    const limits: UsageLimits = {
      fiveHour:
        orm.five_hour_used !== null && orm.five_hour_resets_at
          ? {
              used: orm.five_hour_used,
              resetsAt: orm.five_hour_resets_at.toISOString(),
            }
          : null,
      sevenDay:
        orm.seven_day_used !== null && orm.seven_day_resets_at
          ? {
              used: orm.seven_day_used,
              resetsAt: orm.seven_day_resets_at.toISOString(),
            }
          : null,
    };
    return {
      id: orm.id,
      takenAt: orm.taken_at,
      limits,
      source: orm.source === 'probe' ? 'probe' : 'job',
      jobId: orm.job_id,
    };
  }
}
