export type ReviewStatus = 'ok' | 'failed';

export type CommentStatus = 'pending' | 'posted' | 'failed';

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
  createdAt: Date;
}
