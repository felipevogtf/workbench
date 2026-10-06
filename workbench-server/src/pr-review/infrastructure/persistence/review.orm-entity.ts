import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ReviewTicket } from '@pr-review/domain/entities/review.props';
import { PullRequestOrmEntity } from './pull-request.orm-entity';

@Entity('reviews')
@Index('IDX_reviews_pull_request_id', ['pull_request_id'])
export class ReviewOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  pull_request_id!: string;

  @ManyToOne(() => PullRequestOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pull_request_id' })
  pull_request?: PullRequestOrmEntity;

  @Column({ type: 'varchar', nullable: true })
  commit!: string | null;

  // Sin FK hacia ai-agents: los módulos son independientes.
  @Column({ type: 'uuid', nullable: true })
  agent_id!: string | null;

  @Column({ type: 'varchar', nullable: true })
  agent_name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', nullable: true })
  doc_path!: string | null;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'varchar' })
  comment_status!: string;

  @Column({ type: 'varchar', nullable: true })
  comment_url!: string | null;

  @Column({ type: 'text', nullable: true })
  comment_error!: string | null;

  /** Foto de los tickets que el agente evaluó en esta revisión. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  tickets!: ReviewTicket[];

  @CreateDateColumn()
  created_at!: Date;
}
