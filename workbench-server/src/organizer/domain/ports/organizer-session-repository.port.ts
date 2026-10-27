import { OrganizerSession } from '../entities/organizer-session.entity';

export interface OrganizerSessionRepositoryPort {
  /** Todas, de la más nueva a la más antigua. */
  findAll(): Promise<OrganizerSession[]>;
  findById(id: string): Promise<OrganizerSession | null>;
  save(session: OrganizerSession): Promise<OrganizerSession>;
}

export const ORGANIZER_SESSION_REPOSITORY_PORT = Symbol(
  'ORGANIZER_SESSION_REPOSITORY_PORT',
);
