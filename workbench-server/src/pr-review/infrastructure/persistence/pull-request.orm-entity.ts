import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pull_requests')
@Unique('UQ_pull_requests_provider_repo_external_id', [
  'provider',
  'repo',
  'external_id',
])
@Index('IDX_pull_requests_status_queued_at', ['status', 'queued_at'])
export class PullRequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  provider!: string;

  @Column({ type: 'varchar' })
  repo!: string;

  @Column({ type: 'varchar' })
  external_id!: string;

  @Column({ type: 'varchar' })
  url!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar' })
  author!: string;

  @Column({ type: 'varchar' })
  source_branch!: string;

  @Column({ type: 'varchar' })
  dest_branch!: string;

  @Column({ type: 'varchar' })
  head_commit!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  ticket_keys!: string[];

  @Column({ type: 'varchar', default: 'open' })
  state!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: string;

  @Column({ type: 'timestamp' })
  queued_at!: Date;

  @Column({ type: 'uuid', nullable: true })
  requested_agent_id!: string | null;

  @Column({ type: 'varchar', nullable: true })
  requested_model!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  last_reviewed_at!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  review_doc_url!: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewed_commit!: string | null;

  @Column({ type: 'text', nullable: true })
  last_error!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
