import { GitProvider } from '@pr-review/domain/entities/pull-request.props';

export interface PullRequestCommentPort {
  readonly provider: GitProvider;
  /** Publica un comentario en la PR y devuelve su URL. */
  postComment(
    repo: string,
    externalId: string,
    markdown: string,
  ): Promise<string>;
}

export const PULL_REQUEST_COMMENT_PORTS = Symbol('PULL_REQUEST_COMMENT_PORTS');
