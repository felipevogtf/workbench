import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ExecutionExtraRepo,
  ExecutionRepo,
  ExecutionTicket,
  FinalReview,
  StageRun,
} from '@executions/domain/entities/execution.props';

@Entity('executions')
export class ExecutionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  issue_id!: string;

  @Column({ type: 'uuid' })
  plan_id!: string;

  @Column({ type: 'jsonb' })
  repo!: ExecutionRepo;

  @Column({ type: 'varchar' })
  branch!: string;

  @Column({ type: 'varchar', nullable: true })
  base_branch!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  extra_repos!: ExecutionExtraRepo[];

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'jsonb' })
  stages!: StageRun[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tickets!: ExecutionTicket[];

  @Column({ type: 'varchar', nullable: true })
  pull_request_url!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  final_review!: FinalReview | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  finished_at!: Date | null;
}
