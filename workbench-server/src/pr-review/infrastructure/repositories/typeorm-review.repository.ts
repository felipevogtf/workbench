import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '@pr-review/domain/entities/review.entity';
import {
  CommentStatus,
  ReviewStatus,
} from '@pr-review/domain/entities/review.props';
import { ReviewRepositoryPort } from '@pr-review/domain/ports/review-repository.port';
import { ReviewOrmEntity } from '@pr-review/infrastructure/persistence/review.orm-entity';

@Injectable()
export class TypeOrmReviewRepository implements ReviewRepositoryPort {
  constructor(
    @InjectRepository(ReviewOrmEntity)
    private readonly reviewRepository: Repository<ReviewOrmEntity>,
  ) {}

  async findById(id: string): Promise<Review | null> {
    const orm = await this.reviewRepository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByPullRequestId(pullRequestId: string): Promise<Review[]> {
    const rows = await this.reviewRepository.find({
      where: { pull_request_id: pullRequestId },
      order: { created_at: 'DESC' },
    });
    return rows.map((orm) => this.toDomain(orm));
  }

  async findLatestSuccessfulByPullRequestId(
    pullRequestId: string,
  ): Promise<Review | null> {
    const orm = await this.reviewRepository.findOne({
      where: { pull_request_id: pullRequestId, status: 'ok' },
      order: { created_at: 'DESC' },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async save(review: Review): Promise<Review> {
    const saved = await this.reviewRepository.save({
      id: review.id,
      pull_request_id: review.pullRequestId,
      commit: review.commit,
      agent_id: review.agentId,
      agent_name: review.agentName,
      model: review.model,
      doc_path: review.docPath,
      status: review.status,
      error: review.error,
      comment_status: review.commentStatus,
      comment_url: review.commentUrl,
      comment_error: review.commentError,
      tickets: review.tickets,
      created_at: review.createdAt,
    });
    return this.toDomain(saved);
  }

  private toDomain(orm: ReviewOrmEntity): Review {
    return Review.reconstruct({
      id: orm.id,
      pullRequestId: orm.pull_request_id,
      commit: orm.commit,
      agentId: orm.agent_id,
      agentName: orm.agent_name,
      model: orm.model,
      docPath: orm.doc_path,
      status: orm.status as ReviewStatus,
      error: orm.error,
      commentStatus: orm.comment_status as CommentStatus,
      commentUrl: orm.comment_url,
      commentError: orm.comment_error,
      tickets: orm.tickets ?? [],
      createdAt: orm.created_at,
    });
  }
}
