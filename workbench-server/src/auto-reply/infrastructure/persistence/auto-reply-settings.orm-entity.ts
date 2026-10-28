import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { AutoReplyContact } from '@auto-reply/domain/auto-reply-settings';

/** Una sola fila (`id = 'default'`): los ajustes del modo «no molestar». */
@Entity('auto_reply_settings')
export class AutoReplySettingsOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'int', default: 60 })
  interval_seconds!: number;

  @Column({ type: 'varchar', default: 'draft' })
  mode!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  contacts!: AutoReplyContact[];

  @UpdateDateColumn()
  updated_at!: Date;
}
