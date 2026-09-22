import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('board_issues')
export class BoardIssueOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  board_id!: string;

  // Único: un issue solo puede estar en un board a la vez (coincide con
  // BoardIssueRepositoryPort.findByIssueId devolviendo un único registro,
  // no un array). Si más adelante un issue debe poder vivir en varios
  // boards, cambia esto por @Index(['board_id', 'issue_id'], { unique: true })
  // y ajusta el puerto para que findByIssueId retorne BoardIssue[].
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  issue_id!: string;

  @Column({ type: 'int' })
  position!: number;

  @CreateDateColumn()
  created_at!: Date;
}
