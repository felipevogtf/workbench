export type ReviewStatus = 'ok' | 'failed';

export type CommentStatus = 'pending' | 'posted' | 'failed';

/** Foto de un ticket tal como lo vio el agente al revisar. */
export interface ReviewTicket {
  key: string;
  title: string | null;
  state: string | null;
  /** false si no existe, no es visible o Plane no respondió. */
  found: boolean;
  url: string;
}

export interface ReviewProps {
  id: string;
  pullRequestId: string;
  commit: string | null;
  agentId: string | null;
  agentName: string | null;
  model: string | null;
  docPath: string | null;
  status: ReviewStatus;
  error: string | null;
  commentStatus: CommentStatus;
  commentUrl: string | null;
  commentError: string | null;
  tickets: ReviewTicket[];
  createdAt: Date;
}
