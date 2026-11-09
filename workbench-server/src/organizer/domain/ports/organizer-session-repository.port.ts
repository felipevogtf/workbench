import { OrganizerSession } from '../entities/organizer-session.entity';

export interface OrganizerSessionRepositoryPort {
  /** Todas, de la más nueva a la más antigua. */
  findAll(): Promise<OrganizerSession[]>;
  findById(id: string): Promise<OrganizerSession | null>;
  /** La sesión que cuelga de esta tarea (la del grupo o la propia tarea), si hay. */
  findByGroupIssueId(issueId: string): Promise<OrganizerSession | null>;
  save(session: OrganizerSession): Promise<OrganizerSession>;
  delete(id: string): Promise<void>;
}

export const ORGANIZER_SESSION_REPOSITORY_PORT = Symbol(
  'ORGANIZER_SESSION_REPOSITORY_PORT',
);
