export type GitProvider = 'bitbucket' | 'github';

/**
 * pending = en cola · reviewing = en curso · reviewed = revisada · failed = la última revisión falló
 * · skipped = omitida a propósito (no se encola sola; se puede re-revisar a mano)
 */
export type PullRequestStatus = 'pending' | 'reviewing' | 'reviewed' | 'failed' | 'skipped';

export type CommentStatus = 'pending' | 'posted' | 'failed';

/** Ticket de Plane detectado en una PR, con su enlace. */
export interface TicketLink {
  key: string;
  url: string;
}

/** Foto de un ticket tal como lo vio el agente al revisar. */
export interface ReviewTicket extends TicketLink {
  title: string | null;
  state: string | null;
  /** false si no existe, no es visible o Plane no respondió. */
  found: boolean;
}

export interface PullRequest {
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
  /** Tickets de Plane detectados en la rama y la descripción. */
  tickets: TicketLink[];
  state: 'open' | 'closed';
  status: PullRequestStatus;
  /** Hay commits que la última revisión no vio. */
  isStale: boolean;
  queuedAt: string;
  lastReviewedAt: string | null;
  reviewDocUrl: string | null;
  reviewedCommit: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  pullRequestId: string;
  commit: string | null;
  agentId: string | null;
  agentName: string | null;
  model: string | null;
  docPath: string | null;
  status: 'ok' | 'failed';
  error: string | null;
  commentStatus: CommentStatus;
  commentUrl: string | null;
  commentError: string | null;
  /** Tickets que el agente evaluó en esta revisión. */
  tickets: ReviewTicket[];
  createdAt: string;
}

export interface PullRequestDetail extends PullRequest {
  /** De la más reciente a la más antigua. */
  reviews: Review[];
}

export interface QueueSnapshot {
  concurrency: number;
  activeWorkers: number;
  reviewing: PullRequest[];
  /** En orden de turno. */
  pending: PullRequest[];
}

export interface SyncResult {
  created: number;
  updated: number;
  closed: number;
}

export interface ReReviewRequest {
  agentId?: string;
  model?: string;
}

export interface PullRequestFilters {
  status: PullRequestStatus | 'all';
  provider: GitProvider | 'all';
  staleOnly: boolean;
}

export const STATUS_LABEL: Record<PullRequestStatus, string> = {
  pending: 'En cola',
  reviewing: 'Revisando',
  reviewed: 'Revisada',
  failed: 'Fallida',
  skipped: 'Omitida',
};

export const PROVIDER_LABEL: Record<GitProvider, string> = {
  bitbucket: 'Bitbucket',
  github: 'GitHub',
};

/** Una PR en cola o en curso cambiará sola: la UI debe seguir refrescando. */
export function isActive(status: PullRequestStatus): boolean {
  return status === 'pending' || status === 'reviewing';
}

export function shortCommit(commit: string | null | undefined): string {
  return commit ? commit.slice(0, 8) : '—';
}
