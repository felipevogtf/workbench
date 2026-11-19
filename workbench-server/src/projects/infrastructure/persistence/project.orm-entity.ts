import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('projects')
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  repo!: string;

  @Column({ type: 'varchar', default: '' })
  name!: string;

  /** La receta. */
  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  depends_on!: string[];

  @Column({ type: 'varchar', default: 'main' })
  main_branch!: string;

  @Column({ type: 'varchar', nullable: true })
  runner_environment!: string | null;

  @Column({ type: 'text', default: '' })
  architecture_rules!: string;

  @Column({ type: 'varchar', nullable: true })
  verify_command!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
