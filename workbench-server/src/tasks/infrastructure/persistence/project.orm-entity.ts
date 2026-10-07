import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IssueOrmEntity } from './issue.orm-entity';
import { ExternalSource } from '@tasks/domain/entities/project.props';

@Entity('projects')
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  external_id!: string | null;

  @Column({ type: 'varchar', nullable: true })
  source!: ExternalSource | null;

  @Column({ type: 'varchar', nullable: true })
  identifier!: string | null;

  @Column({ type: 'boolean', default: true })
  sync_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  visible!: boolean;

  @Column()
  name!: string;

  @OneToMany(() => IssueOrmEntity, (issue) => issue.project)
  issues!: IssueOrmEntity[];

  // Nota: NO es @UpdateDateColumn() a propósito — ese decorador hace que
  // TypeORM lo pise en TODO .save(), no solo cuando se llama markAsSynced().
  // Es una columna de dominio normal, controlada explícitamente por Project.
  @Column({ type: 'timestamp', nullable: true })
  synced_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;
}
