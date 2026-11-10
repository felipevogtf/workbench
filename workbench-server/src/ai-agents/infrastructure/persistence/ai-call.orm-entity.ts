import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_calls')
export class AiCallOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'timestamp' })
  at!: Date;

  @Column({ type: 'varchar' })
  module!: string;

  @Column({ type: 'uuid', nullable: true })
  agent_id!: string | null;

  @Column({ type: 'varchar', nullable: true })
  agent_name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  model!: string | null;

  @Column({ type: 'double precision', default: 0 })
  input_tokens!: number;

  @Column({ type: 'double precision', default: 0 })
  output_tokens!: number;

  @Column({ type: 'double precision', default: 0 })
  cache_write_tokens!: number;

  @Column({ type: 'double precision', default: 0 })
  cache_read_tokens!: number;

  @Column({ type: 'double precision', default: 0 })
  cost_usd!: number;
}
