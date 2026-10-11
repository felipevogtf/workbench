import type { CredentialItem } from './credential-item.entity';

export interface CredentialGroupProps {
  id: string;
  name: string;
  category: string | null;
  items: CredentialItem[];
  createdAt: Date;
  updatedAt: Date;
}
