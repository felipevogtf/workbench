export type ExternalSource = 'plane' | 'jira';

export interface ProjectProps {
  id: string;
  name: string;
  externalId: string | null;
  source: ExternalSource | null;
  /** Prefijo de las claves de ticket en Plane (`MEL`); null en los locales. */
  identifier: string | null;
  syncedAt: Date | null;
  createdAt: Date;
}
