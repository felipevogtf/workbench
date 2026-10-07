import { DomainError } from '@core/domain/domain.error';
import { Agent } from '@ai-agents/domain/entities/agent.entity';
import { AgentRepositoryPort } from '@ai-agents/domain/ports/agent-repository.port';
import { AgentModule } from '@ai-agents/domain/modules';
import { AgentsService } from './agents.service';
import { AgentProvidersService } from './agent-providers.service';

function build(initial: Agent[]) {
  const agents = [...initial];
  const repo: AgentRepositoryPort = {
    findById: (id) => Promise.resolve(agents.find((a) => a.id === id) ?? null),
    findByName: (name) =>
      Promise.resolve(agents.find((a) => a.name === name) ?? null),
    findDefault: (module: AgentModule) =>
      Promise.resolve(
        agents.find((a) => a.isDefault && a.module === module) ?? null,
      ),
    findAll: (module?: AgentModule) =>
      Promise.resolve(agents.filter((a) => !module || a.module === module)),
    save: (agent) => {
      if (!agents.includes(agent)) agents.push(agent);
      return Promise.resolve(agent);
    },
    delete: () => Promise.resolve(),
    clearDefault: (module: AgentModule) => {
      agents
        .filter((a) => a.module === module)
        .forEach((a) => a.unmarkAsDefault());
      return Promise.resolve();
    },
  };
  const runner = { run: jest.fn().mockResolvedValue('plan') };
  const providers = new AgentProvidersService({
    list: () => [
      { id: 'claude', label: 'Claude', models: ['m'], enabled: true },
    ],
  });
  return {
    service: new AgentsService(repo, runner, providers),
    runner,
    agents,
  };
}

const make = (name: string, module: AgentModule, isDefault = false) =>
  Agent.create({ name, systemPrompt: 'p', model: 'm', module, isDefault });

describe('AgentsService modules', () => {
  it('keeps one default agent per module', async () => {
    const { service } = build([
      make('rev', 'pr-review', true),
      make('plan', 'planner', true),
    ]);

    const second = await service.create({
      name: 'plan-2',
      systemPrompt: 'p',
      model: 'm',
      module: 'planner',
      isDefault: true,
    });

    expect((await service.getDefault('planner')).id).toBe(second.id);
    expect((await service.getDefault('pr-review')).name).toBe('rev');
  });

  it('marks a default only inside its module', async () => {
    const rev = make('rev', 'pr-review', true);
    const plan = make('plan', 'planner', false);
    const { service } = build([rev, plan]);

    await service.setDefault(plan.id);

    expect(rev.isDefault).toBe(true);
    expect(plan.isDefault).toBe(true);
  });

  it('lists the agents of one module', async () => {
    const { service } = build([
      make('rev', 'pr-review'),
      make('plan', 'planner'),
    ]);
    expect((await service.findAll('planner')).map((a) => a.name)).toEqual([
      'plan',
    ]);
  });

  it('runs the default agent of the calling module', async () => {
    const { service, runner } = build([
      make('rev', 'pr-review', true),
      make('plan', 'planner', true),
    ]);

    const result = await service.run({
      module: 'planner',
      prompt: 'x',
      workdir: '/tmp',
    });

    expect(result.agentName).toBe('plan');
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it('refuses an agent that belongs to another module', async () => {
    const rev = make('rev', 'pr-review', true);
    const { service } = build([rev]);

    await expect(
      service.run({
        module: 'planner',
        agentId: rev.id,
        prompt: 'x',
        workdir: '/tmp',
      }),
    ).rejects.toThrow(DomainError);
  });
});
