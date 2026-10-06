export interface IssueProps {
  id: string;
  name: string;
  isLocal: boolean;
  externalId: string | null;
  externalState: string | null;
  remoteSequence: number | null;
  localSequence: number;
  description: string | null;
  priority: string | null;
  stateId: string | null;
  projectId: string;
  labelIds: string[];
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  syncedAt: Date;
  createdAt: Date;
}
