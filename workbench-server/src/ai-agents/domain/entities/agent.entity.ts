import { DomainError } from '@core/domain/domain.error';
import { AgentProps } from './agent.props';
import {
  AGENT_MODULES,
  AgentModule,
  DEFAULT_MODULE,
  MODULE_TOOLS,
  isAgentModule,
} from '@ai-agents/domain/modules';
import {
  AGENT_PROVIDERS,
  AgentProvider,
  DEFAULT_PROVIDER,
  isAgentProvider,
} from '@ai-agents/domain/providers';

/** Herramientas del módulo de revisión de PRs (compatibilidad); ver MODULE_TOOLS. */
export const ALLOWED_AGENT_TOOLS = MODULE_TOOLS['pr-review'];

export class Agent {
  private constructor(private props: AgentProps) {
    Agent.assertValid(props);
  }

  static create(data: {
    name: string;
    systemPrompt: string;
    model: string;
    module?: AgentModule;
    provider?: AgentProvider;
    allowedTools?: string[];
    isDefault?: boolean;
  }): Agent {
    const now = new Date();
    const module = data.module ?? DEFAULT_MODULE;
    return new Agent({
      id: crypto.randomUUID(),
      name: data.name,
      systemPrompt: data.systemPrompt,
      module,
      provider: data.provider ?? DEFAULT_PROVIDER,
      model: data.model,
      allowedTools: data.allowedTools ?? [...MODULE_TOOLS[module]],
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
      Pick<
        AgentProps,
        'name' | 'systemPrompt' | 'model' | 'provider' | 'allowedTools'
      >
    >,
  ): void {
    const next = { ...this.props };
    if (data.name !== undefined) next.name = data.name;
    if (data.systemPrompt !== undefined) next.systemPrompt = data.systemPrompt;
    if (data.model !== undefined) next.model = data.model;
    if (data.provider !== undefined) next.provider = data.provider;
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

    if (!isAgentProvider(props.provider)) {
      throw new DomainError(
        'Agent provider must be one of: ' + AGENT_PROVIDERS.join(', '),
      );
    }

    if (!isAgentModule(props.module)) {
      throw new DomainError(
        'Agent module must be one of: ' + AGENT_MODULES.join(', '),
      );
    }

    const allowed = MODULE_TOOLS[props.module];
    const forbidden = props.allowedTools.filter(
      (tool) => !allowed.includes(tool),
    );
    if (forbidden.length > 0) {
      throw new DomainError(
        `Tools not allowed for an agent: ${forbidden.join(', ')}. ` +
          `Allowed tools for ${props.module}: ${allowed.join(', ')}`,
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

  get module(): AgentModule {
    return this.props.module;
  }

  get provider(): AgentProvider {
    return this.props.provider;
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
