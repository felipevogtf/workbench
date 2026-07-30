import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IssueOrmEntity } from './issue.orm-entity';

@Entity('projects')
export class ProjectOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  external_id!: string | null;

  @Column()
  name!: string;

  @OneToMany(() => IssueOrmEntity, (issue) => issue.project)
  issues!: IssueOrmEntity[];

  @UpdateDateColumn()
  synced_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
