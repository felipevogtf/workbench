export type ExternalSource = 'plane' | 'jira';

export interface ProjectProps {
  id: string;
  name: string;
  externalId: string | null;
  source: ExternalSource | null;
  syncedAt: Date | null;
  createdAt: Date;
}
