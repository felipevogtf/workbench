export type GitProvider = 'bitbucket' | 'github';

export type PullRequestState = 'open' | 'closed';

/**
 * pending   = en cola, esperando revisión
 * reviewing = en curso
 * reviewed  = revisada
 * failed    = la última revisión falló
 * skipped   = omitida a propósito (ej. backlog previo): el sync no la encola; se puede re-revisar a mano
 */
export type PullRequestStatus =
  'pending' | 'reviewing' | 'reviewed' | 'failed' | 'skipped';

export interface PullRequestProps {
  id: string;
  provider: GitProvider;
  repo: string;
  externalId: string;
  url: string;
  title: string;
  author: string;
  sourceBranch: string;
  destBranch: string;
  headCommit: string;
  state: PullRequestState;
  status: PullRequestStatus;
  queuedAt: Date;
  requestedAgentId: string | null;
  requestedModel: string | null;
  lastReviewedAt: Date | null;
  reviewDocUrl: string | null;
  reviewedCommit: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
