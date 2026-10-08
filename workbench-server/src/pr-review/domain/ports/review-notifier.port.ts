import type { GitProvider } from '@pr-review/domain/entities/pull-request.props';

/** Lo que el notificador necesita saber de la PR revisada. */
export interface ReviewedPullRequest {
  provider: GitProvider;
  repo: string;
  externalId: string;
  title: string;
  author: string;
  url: string;
}

export interface ReviewNotifierPort {
  /** Envía la revisión (markdown) al autor de la PR, con el enlace a la PR. */
  notifyAuthor(
    pullRequest: ReviewedPullRequest,
    markdown: string,
  ): Promise<void>;
}

export const REVIEW_NOTIFIER_PORT = Symbol('REVIEW_NOTIFIER_PORT');
