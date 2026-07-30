import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IssueOrmEntity } from './issue.orm-entity';

@Entity('states')
export class StateOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @Column({ default: 0 })
  position!: number;

  @OneToMany(() => IssueOrmEntity, (issue) => issue.state)
  issues!: IssueOrmEntity[];
}
