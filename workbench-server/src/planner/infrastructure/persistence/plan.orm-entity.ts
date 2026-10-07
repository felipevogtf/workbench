import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';

@Entity('plans')
export class PlanOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  issue_id!: string;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'varchar', nullable: true })
  requested_agent_id!: string | null;

  @Column({ type: 'varchar', nullable: true })
  requested_model!: string | null;

  @Column({ type: 'varchar', nullable: true })
  agent_id!: string | null;

  @Column({ type: 'varchar', nullable: true })
  agent_name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  model!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  repos!: PlanRepoInfo[];

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'timestamp' })
  queued_at!: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
