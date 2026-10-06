import { DomainError } from '@core/domain/domain.error';
import { AgentProps } from './agent.props';

/**
 * Herramientas que un agente puede usar. Es una lista cerrada y de solo lectura:
 * el agente corre sobre código y descripciones de PRs que pueden contener
 * instrucciones maliciosas (prompt injection), así que no puede escribir ni
 * ejecutar comandos arbitrarios.
 */
export const ALLOWED_AGENT_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
] as const;

export class Agent {
  private constructor(private props: AgentProps) {
    Agent.assertValid(props);
  }

  static create(data: {
    name: string;
    systemPrompt: string;
    model: string;
    allowedTools?: string[];
    isDefault?: boolean;
  }): Agent {
    const now = new Date();
    return new Agent({
      id: crypto.randomUUID(),
      name: data.name,
      systemPrompt: data.systemPrompt,
      model: data.model,
      allowedTools: data.allowedTools ?? [...ALLOWED_AGENT_TOOLS],
      isDefault: data.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: AgentProps): Agent {
    return new Agent(props);
  }

  update(
    data: Partial<
      Pick<AgentProps, 'name' | 'systemPrompt' | 'model' | 'allowedTools'>
    >,
  ): void {
    const next = { ...this.props };
    if (data.name !== undefined) next.name = data.name;
    if (data.systemPrompt !== undefined) next.systemPrompt = data.systemPrompt;
    if (data.model !== undefined) next.model = data.model;
    if (data.allowedTools !== undefined) next.allowedTools = data.allowedTools;
    next.updatedAt = new Date();

    // Valida antes de aplicar: si falla, la entidad queda intacta.
    Agent.assertValid(next);
    this.props = next;
  }

  markAsDefault(): void {
    this.props.isDefault = true;
  }

  unmarkAsDefault(): void {
    this.props.isDefault = false;
  }

  private static assertValid(props: AgentProps): void {
    if (!props.name?.trim()) {
      throw new DomainError('Agent name cannot be empty');
    }
    if (!props.systemPrompt?.trim()) {
      throw new DomainError('Agent systemPrompt cannot be empty');
    }
    if (!props.model?.trim()) {
      throw new DomainError('Agent model cannot be empty');
    }

    const forbidden = props.allowedTools.filter(
      (tool) => !(ALLOWED_AGENT_TOOLS as readonly string[]).includes(tool),
    );
    if (forbidden.length > 0) {
      throw new DomainError(
        `Tools not allowed for an agent: ${forbidden.join(', ')}. ` +
          `Allowed tools: ${ALLOWED_AGENT_TOOLS.join(', ')}`,
      );
    }
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get systemPrompt(): string {
    return this.props.systemPrompt;
  }

  get model(): string {
    return this.props.model;
  }

  get allowedTools(): string[] {
    return [...this.props.allowedTools];
  }

  get isDefault(): boolean {
    return this.props.isDefault;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
