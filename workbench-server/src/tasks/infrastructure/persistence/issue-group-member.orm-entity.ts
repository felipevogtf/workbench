import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Un miembro de un grupo de tareas, con su lugar en el orden del grupo. */
@Entity('issue_group_members')
export class IssueGroupMemberOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  group_issue_id!: string;

  @PrimaryColumn({ type: 'uuid' })
  member_issue_id!: string;

  @Column({ type: 'int' })
  position!: number;
}
