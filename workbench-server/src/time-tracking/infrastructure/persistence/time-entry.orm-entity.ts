import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('time_entries')
export class TimeEntryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  issue_id!: string;

  @Column({ type: 'decimal', precision: 4, scale: 2 })
  hours!: number;

  @Column({ type: 'date' })
  date!: string;

  @CreateDateColumn()
  created_at!: Date;
}
