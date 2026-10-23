import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('runners')
export class RunnerOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  token_hash!: string;

  @Column({ type: 'varchar', nullable: true })
  version!: string | null;

  @Column({ type: 'varchar', nullable: true })
  host!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  last_seen_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;
}
