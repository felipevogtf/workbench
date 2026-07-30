import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  // OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LabelOrmEntity } from './label.orm-entity';
import { ProjectOrmEntity } from './project.orm-entity';
import { StateOrmEntity } from './state.orm-entity';

@Entity('issues')
export class IssueOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  external_id!: string | null;

  @Column({ default: false })
  is_local!: boolean;

  @ManyToOne(() => ProjectOrmEntity, (project) => project.issues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectOrmEntity;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  priority!: string | null;

  @Column({ type: 'varchar', nullable: true })
  external_state!: string | null;

  @Column({ type: 'int', nullable: true })
  sequence_number!: number | null;

  @Column({ type: 'int', nullable: true })
  local_id!: number | null;

  @ManyToOne(() => StateOrmEntity, (state) => state.issues, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'state_id' })
  state!: StateOrmEntity | null;

  @Column({ type: 'date', nullable: true })
  start_date!: string | null;

  @Column({ type: 'date', nullable: true })
  due_date!: string | null;

  @Column({ type: 'decimal', nullable: true, precision: 10, scale: 2 })
  estimated_hours!: number | null;

  @ManyToMany(() => LabelOrmEntity, (label) => label.issues, { cascade: true })
  @JoinTable({
    name: 'issue_labels',
    joinColumn: { name: 'issue_id' },
    inverseJoinColumn: { name: 'label_id' },
  })
  labels!: LabelOrmEntity[];

  // @OneToMany(() => BoardIssueOrmEntity, (bi) => bi.issue)
  // board_issues: BoardIssueOrmEntity[];

  @UpdateDateColumn()
  synced_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
