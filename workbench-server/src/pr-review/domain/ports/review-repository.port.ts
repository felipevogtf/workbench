import { Review } from '@pr-review/domain/entities/review.entity';

export interface ReviewRepositoryPort {
  findById(id: string): Promise<Review | null>;
  /** Historial de una PR, de la más reciente a la más antigua. */
  findByPullRequestId(pullRequestId: string): Promise<Review[]>;
  findLatestSuccessfulByPullRequestId(
    pullRequestId: string,
  ): Promise<Review | null>;
  save(review: Review): Promise<Review>;
  delete(id: string): Promise<void>;
}

export const REVIEW_REPOSITORY_PORT = Symbol('REVIEW_REPOSITORY_PORT');
