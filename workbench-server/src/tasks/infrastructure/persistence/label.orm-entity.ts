import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IssueOrmEntity } from './issue.orm-entity';

@Entity('labels')
export class LabelOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @ManyToMany(() => IssueOrmEntity, (issue) => issue.labels)
  issues!: IssueOrmEntity[];
}
