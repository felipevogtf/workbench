import { ReplyDraft } from '../reply-draft';

export interface ReplyDraftRepositoryPort {
  save(draft: ReplyDraft): Promise<ReplyDraft>;
  findById(id: string): Promise<ReplyDraft | null>;
  /** Los más nuevos primero. */
  findRecent(limit: number): Promise<ReplyDraft[]>;
}

export const REPLY_DRAFT_REPOSITORY_PORT = Symbol(
  'REPLY_DRAFT_REPOSITORY_PORT',
);
