import { AiCall } from '@ai-agents/domain/ai-call';

export interface AiCallRepositoryPort {
  save(call: AiCall): Promise<void>;
  /** Las llamadas hechas desde `since`, de la más antigua a la más nueva. */
  findSince(since: Date): Promise<AiCall[]>;
}

export const AI_CALL_REPOSITORY_PORT = Symbol('AI_CALL_REPOSITORY_PORT');
