import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizerSession } from '@organizer/domain/entities/organizer-session.entity';
import { OrganizerSessionRepositoryPort } from '@organizer/domain/ports/organizer-session-repository.port';
import { OrganizerSessionOrmEntity } from '@organizer/infrastructure/persistence/organizer-session.orm-entity';

@Injectable()
export class TypeOrmOrganizerSessionRepository implements OrganizerSessionRepositoryPort {
  constructor(
    @InjectRepository(OrganizerSessionOrmEntity)
    private readonly ormRepo: Repository<OrganizerSessionOrmEntity>,
  ) {}

  async findAll(): Promise<OrganizerSession[]> {
    const rows = await this.ormRepo.find({ order: { created_at: 'DESC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<OrganizerSession | null> {
    const row = await this.ormRepo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(session: OrganizerSession): Promise<OrganizerSession> {
    const props = session.toProps();
    const saved = await this.ormRepo.save({
      id: props.id,
      title: props.title,
      group_issue_id: props.groupIssueId,
      created_at: props.createdAt,
    });
    return this.toDomain(saved);
  }

  private toDomain(row: OrganizerSessionOrmEntity): OrganizerSession {
    return OrganizerSession.reconstruct({
      id: row.id,
      title: row.title,
      groupIssueId: row.group_issue_id,
      createdAt: row.created_at,
    });
  }
}
