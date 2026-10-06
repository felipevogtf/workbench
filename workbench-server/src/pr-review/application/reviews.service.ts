import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { Review } from '@pr-review/domain/entities/review.entity';
import {
  PULL_REQUEST_REPOSITORY_PORT,
  type PullRequestRepositoryPort,
} from '@pr-review/domain/ports/pull-request-repository.port';
import {
  REVIEW_REPOSITORY_PORT,
  type ReviewRepositoryPort,
} from '@pr-review/domain/ports/review-repository.port';
import {
  REPOSITORY_CHECKOUT_PORT,
  type RepositoryCheckout,
  type RepositoryCheckoutPort,
} from '@pr-review/domain/ports/repository-checkout.port';
import {
  REVIEW_STORAGE_PORT,
  type ReviewStoragePort,
} from '@pr-review/domain/ports/review-storage.port';
import {
  AGENTS_GATEWAY_PORT,
  type AgentsGatewayPort,
} from '@pr-review/domain/ports/agents-gateway.port';
import {
  PULL_REQUEST_COMMENT_PORTS,
  type PullRequestCommentPort,
} from '@pr-review/domain/ports/pull-request-comment.port';

/** Cuántas PRs se pueden revisar a la vez. */
export const REVIEW_CONCURRENCY = Symbol('REVIEW_CONCURRENCY');

const MAX_ERROR_LENGTH = 2000;

export interface ReviewQueueSnapshot {
  concurrency: number;
  activeWorkers: number;
  reviewing: PullRequest[];
  pending: PullRequest[];
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private activeWorkers = 0;
  private rekick = false;

  constructor(
    @Inject(PULL_REQUEST_REPOSITORY_PORT)
    private readonly pullRequests: PullRequestRepositoryPort,
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviews: ReviewRepositoryPort,
    @Inject(REPOSITORY_CHECKOUT_PORT)
    private readonly checkoutPort: RepositoryCheckoutPort,
    @Inject(REVIEW_STORAGE_PORT)
    private readonly storage: ReviewStoragePort,
    @Inject(AGENTS_GATEWAY_PORT)
    private readonly agents: AgentsGatewayPort,
    @Inject(PULL_REQUEST_COMMENT_PORTS)
    private readonly commentPorts: PullRequestCommentPort[],
    @Inject(REVIEW_CONCURRENCY)
    private readonly concurrency: number,
  ) {}

  /**
   * Despierta a los workers de la cola. Quien encola (sync, re-review, cron)
   * nunca revisa directamente: solo deja la PR en `pending` y llama a kick().
   */
  kick(): void {
    if (this.activeWorkers >= this.concurrency) {
      // Todos los workers están ocupados; que revisen la cola otra vez al terminar.
      this.rekick = true;
      return;
    }

    while (this.activeWorkers < this.concurrency) {
      this.activeWorkers++;
      void this.runWorker();
    }
  }

  async reReview(
    pullRequestId: string,
    override: { agentId?: string; model?: string } = {},
  ): Promise<PullRequest> {
    const pullRequest = await this.getPullRequest(pullRequestId);

    pullRequest.enqueue({
      agentId: override.agentId?.trim() || undefined,
      model: override.model?.trim() || undefined,
    });
    const saved = await this.pullRequests.save(pullRequest);

    this.kick();
    return saved;
  }

  /** Reintenta solo el comentario de la última revisión, sin volver a revisar. */
  async retryComment(pullRequestId: string): Promise<Review> {
    const pullRequest = await this.getPullRequest(pullRequestId);
    const review = await this.reviews.findLatestSuccessfulByPullRequestId(
      pullRequest.id,
    );
    if (!review || !review.docPath) {
      throw new NotFoundException(
        `Pull request ${pullRequestId} has no completed review`,
      );
    }
    if (review.commentStatus === 'posted') {
      throw new ConflictException('The comment was already posted');
    }

    const markdown = await this.storage.read(review.docPath);
    await this.publishComment(pullRequest, review, markdown);
    return review;
  }

  async readLatestReview(pullRequestId: string): Promise<string> {
    const pullRequest = await this.getPullRequest(pullRequestId);
    const review = await this.reviews.findLatestSuccessfulByPullRequestId(
      pullRequest.id,
    );
    if (!review || !review.docPath) {
      throw new NotFoundException(
        `Pull request ${pullRequestId} has no completed review`,
      );
    }
    return this.storage.read(review.docPath);
  }

  async readReview(pullRequestId: string, reviewId: string): Promise<string> {
    const review = await this.reviews.findById(reviewId);
    if (!review || review.pullRequestId !== pullRequestId || !review.docPath) {
      throw new NotFoundException(
        `Review ${reviewId} not found for pull request ${pullRequestId}`,
      );
    }
    return this.storage.read(review.docPath);
  }

  async getQueue(): Promise<ReviewQueueSnapshot> {
    const [reviewing, pending] = await Promise.all([
      this.pullRequests.findByStatus('reviewing'),
      this.pullRequests.findByStatus('pending'),
    ]);
    return {
      concurrency: this.concurrency,
      activeWorkers: this.activeWorkers,
      reviewing,
      pending,
    };
  }

  /**
   * Al arrancar: lo que quedó en `reviewing` por un corte no terminó, así que
   * pasa a `failed` (se reencola a mano con re-review). Las `pending` se retoman.
   */
  async recoverInterrupted(): Promise<number> {
    const interrupted = await this.pullRequests.findByStatus('reviewing');
    for (const pullRequest of interrupted) {
      pullRequest.markFailed('Interrupted by a server restart');
      await this.pullRequests.save(pullRequest);
    }

    this.kick();
    return interrupted.length;
  }

  private async runWorker(): Promise<void> {
    try {
      for (;;) {
        this.rekick = false;
        const pullRequest = await this.pullRequests.claimNextPending();

        if (!pullRequest) {
          // Si alguien encoló mientras consultábamos, damos otra vuelta.
          if (this.rekick) continue;
          return;
        }

        await this.executeReview(pullRequest);
      }
    } catch (error) {
      this.logger.error(`Review worker crashed: ${this.errorMessage(error)}`);
    } finally {
      this.activeWorkers--;
    }
  }

  /** Recibe una PR ya reclamada (`reviewing`). Nunca lanza: registra el fallo. */
  private async executeReview(pullRequest: PullRequest): Promise<void> {
    const requestedAgentId = pullRequest.requestedAgentId ?? undefined;
    const requestedModel = pullRequest.requestedModel ?? undefined;
    let checkout: RepositoryCheckout | null = null;

    this.logger.log(
      `Reviewing ${pullRequest.provider}:${pullRequest.repo}#${pullRequest.externalId}`,
    );

    try {
      checkout = await this.checkoutPort.checkout(pullRequest);

      const run = await this.agents.runReview({
        agentId: requestedAgentId,
        model: requestedModel,
        prompt: this.buildPrompt(pullRequest),
        workdir: checkout.path,
      });

      const docPath = await this.storage.save(
        pullRequest,
        checkout.commit,
        run.markdown,
      );

      // La revisión queda registrada antes de comentar: si el comentario falla
      // no se pierde ni hay que volver a pagarla.
      const review = await this.reviews.save(
        Review.createSucceeded({
          pullRequestId: pullRequest.id,
          commit: checkout.commit,
          agentId: run.agentId,
          agentName: run.agentName,
          model: run.model,
          docPath,
        }),
      );
      await this.publishComment(pullRequest, review, run.markdown);

      pullRequest.markReviewed({ commit: checkout.commit, docPath });
      await this.pullRequests.save(pullRequest);
    } catch (error) {
      const message = this.errorMessage(error);
      this.logger.warn(
        `Review failed for ${pullRequest.repo}#${pullRequest.externalId}: ${message}`,
      );
      await this.recordFailure(
        pullRequest,
        message,
        checkout?.commit ?? null,
        requestedAgentId,
        requestedModel,
      );
    } finally {
      await checkout?.dispose().catch((error: unknown) => {
        this.logger.warn(
          `Could not clean checkout: ${this.errorMessage(error)}`,
        );
      });
    }
  }

  private async recordFailure(
    pullRequest: PullRequest,
    message: string,
    commit: string | null,
    agentId: string | undefined,
    model: string | undefined,
  ): Promise<void> {
    try {
      await this.reviews.save(
        Review.createFailed({
          pullRequestId: pullRequest.id,
          commit,
          agentId: agentId ?? null,
          agentName: null,
          model: model ?? null,
          error: message,
        }),
      );
      pullRequest.markFailed(message);
      await this.pullRequests.save(pullRequest);
    } catch (error) {
      this.logger.error(
        `Could not record failure of ${pullRequest.id}: ${this.errorMessage(error)}`,
      );
    }
  }

  private async publishComment(
    pullRequest: PullRequest,
    review: Review,
    markdown: string,
  ): Promise<void> {
    try {
      const port = this.commentPorts.find(
        (candidate) => candidate.provider === pullRequest.provider,
      );
      if (!port) {
        throw new Error(
          `No comment adapter configured for ${pullRequest.provider}`,
        );
      }

      const url = await port.postComment(
        pullRequest.repo,
        pullRequest.externalId,
        this.buildCommentBody(review, markdown),
      );
      review.markCommentPosted(url);
    } catch (error) {
      review.markCommentFailed(this.errorMessage(error));
    }

    await this.reviews.save(review);
  }

  private buildPrompt(pullRequest: PullRequest): string {
    return [
      `# PR #${pullRequest.externalId}: ${pullRequest.title}`,
      `Repositorio: ${pullRequest.repo}`,
      `Autor: ${pullRequest.author}`,
      `Rama: ${pullRequest.sourceBranch} -> ${pullRequest.destBranch}`,
      `URL: ${pullRequest.url}`,
      '',
      `Para ver los cambios usa: git diff origin/${pullRequest.destBranch}...origin/${pullRequest.sourceBranch}`,
    ].join('\n');
  }

  private buildCommentBody(review: Review, markdown: string): string {
    const info = [
      review.agentName ? `agente: ${review.agentName}` : null,
      review.model ? `modelo: ${review.model}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      '**Revisión automática generada por Claude** ' +
      '(borrador, puede contener errores)' +
      (info ? `\n_${info}_` : '') +
      `\n\n${markdown}`
    );
  }

  private async getPullRequest(id: string): Promise<PullRequest> {
    const pullRequest = await this.pullRequests.findById(id);
    if (!pullRequest) {
      throw new NotFoundException(`Pull request with id ${id} not found`);
    }
    return pullRequest;
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, MAX_ERROR_LENGTH);
  }
}
