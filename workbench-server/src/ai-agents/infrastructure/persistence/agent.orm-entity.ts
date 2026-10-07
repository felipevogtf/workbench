import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agents')
export class AgentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'text' })
  system_prompt!: string;

  @Column({ type: 'varchar', default: 'pr-review' })
  module!: string;

  @Column({ type: 'varchar', default: 'claude' })
  provider!: string;

  @Column({ type: 'varchar' })
  model!: string;

  @Column({ type: 'text', array: true })
  allowed_tools!: string[];

  @Column({ type: 'boolean', default: false })
  is_default!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
