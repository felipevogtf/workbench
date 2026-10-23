import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  JobPayload,
  JobResult,
} from '@executions/domain/entities/job.props';

@Entity('execution_jobs')
export class JobOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  execution_id!: string;

  @Column({ type: 'varchar' })
  kind!: string;

  @Column({ type: 'uuid', nullable: true })
  ticket_id!: string | null;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'jsonb' })
  payload!: JobPayload;

  @Column({ type: 'jsonb', nullable: true })
  result!: JobResult | null;

  @Column({ type: 'text', default: '' })
  logs!: string;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'uuid', nullable: true })
  runner_id!: string | null;

  @Column({ type: 'int', default: 1 })
  attempt!: number;

  @Column({ type: 'double precision', nullable: true })
  cost_usd!: number | null;

  @Column({ type: 'timestamp' })
  queued_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  finished_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
