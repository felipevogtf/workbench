import { DomainError } from '@core/domain/domain.error';
import { Inject, Injectable } from '@nestjs/common';
import { Semaphore } from '@core/async/semaphore';
import {
  AGENTS_GATEWAY_PORT,
  type AgentsGatewayPort,
} from '@pr-review/domain/ports/agents-gateway.port';
import {
  REPOSITORY_CACHE_PORT,
  type RepositoryCachePort,
} from '@pr-review/domain/ports/repository-cache.port';
import { PullRequestsService } from '@pr-review/application/pull-requests.service';
import {
  buildChatPrompt,
  type ChatFileContext,
  type ChatMessage,
} from '@pr-review/application/chat-prompt';

/** Cuántas preguntas del chat se contestan a la vez; las demás esperan su turno. */
export const CHAT_CONCURRENCY = Symbol('CHAT_CONCURRENCY');

export interface ChatReply {
  reply: string;
  agentName: string;
  model: string;
  /** Commit de la rama de la PR sobre el que contestó el agente. */
  commit: string;
}

/** Chat sobre el código de una PR: el agente lee el repo de la PR (rama a mergear) para responder. */
@Injectable()
export class PullRequestChatService {
  private readonly limiter: Semaphore;

  constructor(
    private readonly pullRequests: PullRequestsService,
    @Inject(REPOSITORY_CACHE_PORT)
    private readonly repositories: RepositoryCachePort,
    @Inject(AGENTS_GATEWAY_PORT)
    private readonly agents: AgentsGatewayPort,
    @Inject(CHAT_CONCURRENCY) concurrency: number,
  ) {
    this.limiter = new Semaphore(concurrency);
  }

  async reply(
    pullRequestId: string,
    messages: readonly ChatMessage[],
    file?: ChatFileContext | null,
  ): Promise<ChatReply> {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || !last.content.trim()) {
      throw new DomainError('The last message of the chat must be the user’s');
    }

    const pullRequest = await this.pullRequests.findById(pullRequestId);

    return this.limiter.run(async () => {
      const repository = await this.repositories.ensure(pullRequest);
      const result = await this.agents.runChat({
        prompt: buildChatPrompt(pullRequest, messages, file),
        workdir: repository.path,
      });

      return {
        reply: result.markdown,
        agentName: result.agentName,
        model: result.model,
        commit: repository.commit,
      };
    });
  }
}
