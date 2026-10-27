import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('organizer_sessions')
export class OrganizerSessionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  /** La tarea local que hace de grupo; si se borra, la sesión se va con ella (clave foránea en cascada). */
  @Column({ type: 'uuid', unique: true })
  group_issue_id!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
