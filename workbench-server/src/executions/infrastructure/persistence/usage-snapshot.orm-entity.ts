import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usage_snapshots')
export class UsageSnapshotOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'timestamp' })
  taken_at!: Date;

  @Column({ type: 'double precision', nullable: true })
  five_hour_used!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  five_hour_resets_at!: Date | null;

  @Column({ type: 'double precision', nullable: true })
  seven_day_used!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  seven_day_resets_at!: Date | null;

  @Column({ type: 'varchar' })
  source!: string;

  @Column({ type: 'uuid', nullable: true })
  job_id!: string | null;
}
