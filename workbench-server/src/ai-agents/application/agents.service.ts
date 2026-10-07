import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentProvidersService } from '@ai-agents/application/agent-providers.service';
import { AgentProvider, DEFAULT_PROVIDER } from '@ai-agents/domain/providers';
import { Agent } from '@ai-agents/domain/entities/agent.entity';
import {
  AGENT_REPOSITORY_PORT,
  type AgentRepositoryPort,
} from '@ai-agents/domain/ports/agent-repository.port';
import {
  AGENT_RUNNER_PORT,
  type AgentRunnerPort,
} from '@ai-agents/domain/ports/agent-runner.port';

interface CreateAgentData {
  name: string;
  systemPrompt: string;
  model: string;
  provider?: AgentProvider;
  allowedTools?: string[];
  isDefault?: boolean;
}

type UpdateAgentData = Partial<
  Pick<
    CreateAgentData,
    'name' | 'systemPrompt' | 'model' | 'provider' | 'allowedTools'
  >
>;

interface RunAgentData {
  agentId?: string;
  model?: string;
  prompt: string;
  workdir: string;
}

export interface AgentRunResult {
  output: string;
  agentId: string;
  agentName: string;
  model: string;
}

@Injectable()
export class AgentsService {
  constructor(
    @Inject(AGENT_REPOSITORY_PORT)
    private readonly repo: AgentRepositoryPort,
    @Inject(AGENT_RUNNER_PORT)
    private readonly runner: AgentRunnerPort,
    private readonly providers: AgentProvidersService,
  ) {}

  async create(data: CreateAgentData): Promise<Agent> {
    await this.assertNameAvailable(data.name);
    this.providers.assertEnabled(data.provider ?? DEFAULT_PROVIDER);

    const agent = Agent.create(data);
    if (agent.isDefault) {
      await this.repo.clearDefault();
    }

    return this.repo.save(agent);
  }

  async update(id: string, data: UpdateAgentData): Promise<Agent> {
    const agent = await this.findById(id);

    if (data.name !== undefined && data.name !== agent.name) {
      await this.assertNameAvailable(data.name);
    }

    if (data.provider !== undefined && data.provider !== agent.provider) {
      this.providers.assertEnabled(data.provider);
    }

    agent.update(data);
    return this.repo.save(agent);
  }

  findAll(): Promise<Agent[]> {
    return this.repo.findAll();
  }

  async findById(id: string): Promise<Agent> {
    const agent = await this.repo.findById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with id ${id} not found`);
    }
    return agent;
  }

  async getDefault(): Promise<Agent> {
    const agent = await this.repo.findDefault();
    if (!agent) {
      throw new NotFoundException('There is no default agent configured');
    }
    return agent;
  }

  async setDefault(id: string): Promise<Agent> {
    const agent = await this.findById(id);

    await this.repo.clearDefault();
    agent.markAsDefault();
    return this.repo.save(agent);
  }

  async delete(id: string): Promise<void> {
    const agent = await this.findById(id);

    if (agent.isDefault) {
      throw new ConflictException(
        'Cannot delete the default agent; mark another agent as default first',
      );
    }

    await this.repo.delete(id);
  }

  async run(data: RunAgentData): Promise<AgentRunResult> {
    const agent = data.agentId
      ? await this.findById(data.agentId)
      : await this.getDefault();
    this.providers.assertEnabled(agent.provider);
    const model = data.model?.trim() || agent.model;

    const output = await this.runner.run({
      agent,
      prompt: data.prompt,
      workdir: data.workdir,
      model,
    });

    return { output, agentId: agent.id, agentName: agent.name, model };
  }

  private async assertNameAvailable(name: string): Promise<void> {
    if (await this.repo.findByName(name)) {
      throw new ConflictException(`An agent named "${name}" already exists`);
    }
  }
}
