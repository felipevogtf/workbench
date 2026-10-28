import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { IncomingLine } from '@auto-reply/domain/reply-draft';

@Entity('auto_reply_drafts')
export class ReplyDraftOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  contact_id!: string;

  @Column({ type: 'varchar' })
  contact_name!: string;

  @Column({ type: 'varchar' })
  channel_id!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  incoming!: IncomingLine[];

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  replies!: string[];

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  sent_at!: Date | null;
}
