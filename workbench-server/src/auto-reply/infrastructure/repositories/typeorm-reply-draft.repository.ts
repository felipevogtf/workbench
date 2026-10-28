import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ReplyDraftRepositoryPort } from '@auto-reply/domain/ports/reply-draft-repository.port';
import {
  DraftAction,
  DraftStatus,
  ReplyDraft,
} from '@auto-reply/domain/reply-draft';
import { ReplyDraftOrmEntity } from '@auto-reply/infrastructure/persistence/reply-draft.orm-entity';

@Injectable()
export class TypeOrmReplyDraftRepository implements ReplyDraftRepositoryPort {
  constructor(
    @InjectRepository(ReplyDraftOrmEntity)
    private readonly repository: Repository<ReplyDraftOrmEntity>,
  ) {}

  async save(draft: ReplyDraft): Promise<ReplyDraft> {
    await this.repository.save({
      id: draft.id,
      contact_id: draft.contactId,
      contact_name: draft.contactName,
      channel_id: draft.channelId,
      incoming: draft.incoming.map((line) => ({ ...line })),
      action: draft.action,
      replies: [...draft.replies],
      reason: draft.reason,
      status: draft.status,
      error: draft.error,
      sent_at: draft.sentAt,
    });
    return (await this.findById(draft.id))!;
  }

  async findById(id: string): Promise<ReplyDraft | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findRecent(limit: number): Promise<ReplyDraft[]> {
    const rows = await this.repository.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
    return rows.map((orm) => this.toDomain(orm));
  }

  private toDomain(orm: ReplyDraftOrmEntity): ReplyDraft {
    return ReplyDraft.reconstruct({
      id: orm.id,
      contactId: orm.contact_id,
      contactName: orm.contact_name,
      channelId: orm.channel_id,
      incoming: orm.incoming ?? [],
      action: orm.action as DraftAction,
      replies: orm.replies ?? [],
      reason: orm.reason,
      status: orm.status as DraftStatus,
      error: orm.error,
      createdAt: orm.created_at,
      sentAt: orm.sent_at,
    });
  }
}
