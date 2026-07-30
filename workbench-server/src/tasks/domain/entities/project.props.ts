export interface ProjectProps {
  id: string;
  name: string;
  externalId: string | null;
  syncedAt: Date;
  createdAt: Date;
}
