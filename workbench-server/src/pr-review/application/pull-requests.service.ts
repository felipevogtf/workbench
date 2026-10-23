import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { Review } from '@pr-review/domain/entities/review.entity';
import { GitProvider } from '@pr-review/domain/entities/pull-request.props';
import {
  PULL_REQUEST_REPOSITORY_PORT,
  type PullRequestFilters,
  type PullRequestRepositoryPort,
} from '@pr-review/domain/ports/pull-request-repository.port';
import {
  REVIEW_REPOSITORY_PORT,
  type ReviewRepositoryPort,
} from '@pr-review/domain/ports/review-repository.port';
import {
  PULL_REQUEST_SOURCE_PORTS,
  type PullRequestSourcePort,
} from '@pr-review/domain/ports/pull-request-source.port';
import {
  TICKETS_GATEWAY_PORT,
  type TicketsGatewayPort,
} from '@pr-review/domain/ports/tickets-gateway.port';
import { extractTicketKeys } from '@core/text/ticket-keys';
import { ReviewsService } from '@pr-review/application/reviews.service';

/** Archivos más grandes que esto no se muestran completos. */
const MAX_FILE_CHARS = 2_000_000;
const MAX_PATH_CHARS = 1024;

/**
 * La ruta se pega en la URL del provider: no puede salirse de ella con `..`, ni empezar con `/`,
 * ni traer caracteres de control.
 */
function assertValidPath(path: string): void {
  const hasControlChar = [...path].some((c) => c.charCodeAt(0) < 32);
  const segments = path.split('/');
  if (
    !path ||
    path.length > MAX_PATH_CHARS ||
    hasControlChar ||
    segments.some((s) => s === '' || s === '.' || s === '..')
  ) {
    throw new DomainError(`Invalid file path: ${path}`);
  }
}

export interface SyncResult {
  created: number;
  updated: number;
  closed: number;
}

@Injectable()
export class PullRequestsService {
  private readonly logger = new Logger(PullRequestsService.name);
  private syncInFlight: Promise<SyncResult> | null = null;

  constructor(
    @Inject(PULL_REQUEST_REPOSITORY_PORT)
    private readonly pullRequests: PullRequestRepositoryPort,
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviews: ReviewRepositoryPort,
    @Inject(PULL_REQUEST_SOURCE_PORTS)
    private readonly sources: PullRequestSourcePort[],
    @Inject(TICKETS_GATEWAY_PORT)
    private readonly tickets: TicketsGatewayPort,
    private readonly reviewsService: ReviewsService,
  ) {}

  /**
   * Trae las PRs donde soy reviewer, las guarda sin duplicarlas y encola las
   * nuevas. Si ya hay un sync en curso (cron + manual) se comparte el mismo.
   */
  sync(): Promise<SyncResult> {
    if (!this.syncInFlight) {
      this.syncInFlight = this.doSync().finally(() => {
        this.syncInFlight = null;
      });
    }
    return this.syncInFlight;
  }

  findAll(filters: PullRequestFilters = {}): Promise<PullRequest[]> {
    return this.pullRequests.findAll(filters);
  }

  /** Enlace al ticket en Plane. */
  ticketUrl(key: string): string {
    return this.tickets.ticketUrl(key);
  }

  async findById(id: string): Promise<PullRequest> {
    const pullRequest = await this.pullRequests.findById(id);
    if (!pullRequest) {
      throw DomainError.notFound(`Pull request with id ${id} not found`);
    }
    return pullRequest;
  }

  async findByIdWithReviews(
    id: string,
  ): Promise<{ pullRequest: PullRequest; reviews: Review[] }> {
    const pullRequest = await this.findById(id);
    const reviews = await this.reviews.findByPullRequestId(id);
    return { pullRequest, reviews };
  }

  /** Diff unificado de la PR, pedido al provider en el momento (siempre refleja el commit vigente). */
  async getDiff(id: string): Promise<string> {
    const pullRequest = await this.findById(id);
    const source = this.sources.find(
      (candidate) => candidate.provider === pullRequest.provider,
    );
    if (!source) {
      throw DomainError.notFound(
        `Provider ${pullRequest.provider} is not configured`,
      );
    }

    const diff = await source.getDiff(pullRequest.repo, pullRequest.externalId);
    if (diff === null) {
      throw DomainError.notFound(
        `Diff of ${pullRequest.repo}#${pullRequest.externalId} not found in ${pullRequest.provider}`,
      );
    }
    return diff;
  }

  /** Contenido de un archivo de la PR en el último commit de su rama, tal como lo entrega el provider. */
  async getFile(id: string, path: string): Promise<string> {
    assertValidPath(path);

    const pullRequest = await this.findById(id);
    const source = this.sources.find(
      (candidate) => candidate.provider === pullRequest.provider,
    );
    if (!source) {
      throw DomainError.notFound(
        `Provider ${pullRequest.provider} is not configured`,
      );
    }

    const content = await source.getFile(
      pullRequest.repo,
      pullRequest.externalId,
      path,
    );
    if (content === null) {
      throw DomainError.notFound(
        `File ${path} not found in ${pullRequest.repo}#${pullRequest.externalId}`,
      );
    }
    if (content.length > MAX_FILE_CHARS) {
      throw new DomainError(`File ${path} is too large to show`);
    }
    return content;
  }

  private async doSync(): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, closed: 0 };
    const identifiers = await this.loadProjectIdentifiers();

    for (const source of this.sources) {
      try {
        await this.syncProvider(source, result, identifiers);
      } catch (error) {
        // Un provider caído no debe cerrar ni tocar sus PRs ni frenar al resto.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Sync failed for ${source.provider}: ${message}`);
      }
    }

    // Aunque no haya PRs nuevas puede haber `pending` (ej. una PR reabierta).
    this.reviewsService.kick();
    return result;
  }

  private async syncProvider(
    source: PullRequestSourcePort,
    result: SyncResult,
    identifiers: string[] | null,
  ): Promise<void> {
    const { pullRequests: remotes, unreachableRepos } =
      await source.getReviewRequestedPullRequests();
    const seen = new Set<string>();

    for (const remote of remotes) {
      seen.add(this.key(remote.provider, remote.repo, remote.externalId));

      const existing = await this.pullRequests.findByExternalKey(
        remote.provider,
        remote.repo,
        remote.externalId,
      );

      if (existing) {
        existing.syncFromRemote(remote);
        this.applyTicketKeys(existing, identifiers);
        await this.pullRequests.save(existing);
        result.updated++;
      } else {
        const created = PullRequest.createFromRemote(remote);
        this.applyTicketKeys(created, identifiers);
        await this.pullRequests.save(created);
        result.created++;
      }
    }

    // Las abiertas que dejaron de aparecer se dan por cerradas, salvo las de
    // repos que no se pudieron consultar.
    const open = await this.pullRequests.findOpenByProvider(source.provider);
    for (const pullRequest of open) {
      const stillListed = seen.has(
        this.key(
          pullRequest.provider,
          pullRequest.repo,
          pullRequest.externalId,
        ),
      );
      if (stillListed || unreachableRepos.includes(pullRequest.repo)) continue;

      pullRequest.markClosed();
      await this.pullRequests.save(pullRequest);
      result.closed++;
    }
  }

  /** null si Plane no respondió: en ese caso no se tocan los tickets ya detectados. */
  private async loadProjectIdentifiers(): Promise<string[] | null> {
    try {
      return await this.tickets.getProjectIdentifiers();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not read Plane projects: ${message}`);
      return null;
    }
  }

  private applyTicketKeys(
    pullRequest: PullRequest,
    identifiers: string[] | null,
  ): void {
    if (!identifiers) return;
    pullRequest.setTicketKeys(
      extractTicketKeys(
        [pullRequest.sourceBranch, pullRequest.description],
        identifiers,
      ),
    );
  }

  private key(provider: GitProvider, repo: string, externalId: string): string {
    return `${provider}|${repo}|${externalId}`;
  }
}
