import { ReviewResponseDto } from './review-response.dto';

export class PullRequestResponseDto {
  id!: string;
  provider!: string;
  repo!: string;
  externalId!: string;
  url!: string;
  title!: string;
  author!: string;
  sourceBranch!: string;
  destBranch!: string;
  headCommit!: string;
  /** Tickets de Plane detectados, con su enlace. */
  tickets!: { key: string; url: string }[];
  state!: string;
  status!: string;
  isStale!: boolean;
  queuedAt!: Date;
  lastReviewedAt!: Date | null;
  reviewDocUrl!: string | null;
  reviewedCommit!: string | null;
  lastError!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PullRequestDetailResponseDto extends PullRequestResponseDto {
  reviews!: ReviewResponseDto[];
}

export class QueueResponseDto {
  concurrency!: number;
  activeWorkers!: number;
  reviewing!: PullRequestResponseDto[];
  pending!: PullRequestResponseDto[];
}
