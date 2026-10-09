import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PullRequestsService } from '@pr-review/application/pull-requests.service';
import { ReviewsService } from '@pr-review/application/reviews.service';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { Review } from '@pr-review/domain/entities/review.entity';
import type {
  GitProvider,
  PullRequestStatus,
} from '@pr-review/domain/entities/pull-request.props';
import {
  PullRequestDetailResponseDto,
  PullRequestResponseDto,
  QueueResponseDto,
} from '@pr-review/dto/pull-request-response.dto';
import { ReviewResponseDto } from '@pr-review/dto/review-response.dto';
import { ReReviewDto } from '@pr-review/dto/re-review.dto';

@Controller('pull-requests')
export class PullRequestsController {
  constructor(
    private readonly pullRequestsService: PullRequestsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Get()
  async findAll(
    @Query('status') status?: PullRequestStatus,
    @Query('provider') provider?: GitProvider,
    @Query('stale') stale?: string,
  ): Promise<PullRequestResponseDto[]> {
    const pullRequests = await this.pullRequestsService.findAll({
      status,
      provider,
      stale: stale === undefined ? undefined : stale === 'true',
    });
    return pullRequests.map((pr) => this.toDto(pr));
  }

  @Post('sync')
  @HttpCode(200)
  sync() {
    return this.pullRequestsService.sync();
  }

  // Las rutas fijas (queue) van antes de ':id' para que no las capture.
  @Get('queue')
  async queue(): Promise<QueueResponseDto> {
    const queue = await this.reviewsService.getQueue();
    return {
      concurrency: queue.concurrency,
      activeWorkers: queue.activeWorkers,
      reviewing: queue.reviewing.map((pr) => this.toDto(pr)),
      pending: queue.pending.map((pr) => this.toDto(pr)),
    };
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
  ): Promise<PullRequestDetailResponseDto> {
    const { pullRequest, reviews } =
      await this.pullRequestsService.findByIdWithReviews(id);
    return {
      ...this.toDto(pullRequest),
      reviews: reviews.map((review) => this.toReviewDto(review)),
    };
  }

  @Get(':id/review')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  readLatestReview(@Param('id') id: string): Promise<string> {
    return this.reviewsService.readLatestReview(id);
  }

  @Get(':id/reviews/:reviewId')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  readReview(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
  ): Promise<string> {
    return this.reviewsService.readReview(id, reviewId);
  }

  @Delete(':id/reviews/:reviewId')
  @HttpCode(204)
  async deleteReview(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
  ): Promise<void> {
    await this.reviewsService.deleteReview(id, reviewId);
  }

  @Post(':id/re-review')
  @HttpCode(202)
  async reReview(
    @Param('id') id: string,
    @Body() dto: ReReviewDto,
  ): Promise<PullRequestResponseDto> {
    const pullRequest = await this.reviewsService.reReview(id, {
      agentId: dto?.agentId,
      model: dto?.model,
    });
    return this.toDto(pullRequest);
  }

  @Post(':id/retry-comment')
  @HttpCode(200)
  async retryComment(@Param('id') id: string): Promise<ReviewResponseDto> {
    return this.toReviewDto(await this.reviewsService.retryComment(id));
  }

  private toDto(pr: PullRequest): PullRequestResponseDto {
    return {
      id: pr.id,
      provider: pr.provider,
      repo: pr.repo,
      externalId: pr.externalId,
      url: pr.url,
      title: pr.title,
      author: pr.author,
      sourceBranch: pr.sourceBranch,
      destBranch: pr.destBranch,
      headCommit: pr.headCommit,
      tickets: pr.ticketKeys.map((key) => ({
        key,
        url: this.pullRequestsService.ticketUrl(key),
      })),
      state: pr.state,
      status: pr.status,
      isStale: pr.isStale,
      queuedAt: pr.queuedAt,
      lastReviewedAt: pr.lastReviewedAt,
      reviewDocUrl: pr.reviewDocUrl,
      reviewedCommit: pr.reviewedCommit,
      lastError: pr.lastError,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
    };
  }

  private toReviewDto(review: Review): ReviewResponseDto {
    return {
      id: review.id,
      pullRequestId: review.pullRequestId,
      commit: review.commit,
      agentId: review.agentId,
      agentName: review.agentName,
      model: review.model,
      docPath: review.docPath,
      status: review.status,
      error: review.error,
      commentStatus: review.commentStatus,
      commentUrl: review.commentUrl,
      commentError: review.commentError,
      tickets: review.tickets,
      createdAt: review.createdAt,
    };
  }
}
