import { DomainError } from '@core/domain/domain.error';
import { Agent, ALLOWED_AGENT_TOOLS } from './agent.entity';

const valid = {
  name: 'reviewer',
  systemPrompt: 'Revisa la PR',
  model: 'claude-sonnet-5-5',
};

describe('Agent', () => {
  it('uses the read-only tools by default and is not default', () => {
    const agent = Agent.create(valid);

    expect(agent.allowedTools).toEqual([...ALLOWED_AGENT_TOOLS]);
    expect(agent.isDefault).toBe(false);
  });

  it.each(['name', 'systemPrompt', 'model'] as const)(
    'rejects an empty %s',
    (field) => {
      expect(() => Agent.create({ ...valid, [field]: '  ' })).toThrow(
        DomainError,
      );
    },
  );

  it.each(['Write', 'Edit', 'Bash', 'Bash(rm:*)'])(
    'rejects the non read-only tool %s',
    (tool) => {
      expect(() => Agent.create({ ...valid, allowedTools: [tool] })).toThrow(
        /not allowed/,
      );
    },
  );

  it('keeps the entity untouched when an update is invalid', () => {
    const agent = Agent.create(valid);

    expect(() => agent.update({ name: 'ok', allowedTools: ['Write'] })).toThrow(
      DomainError,
    );
    expect(agent.name).toBe('reviewer');
  });

  it('applies a valid partial update', () => {
    const agent = Agent.create(valid);

    agent.update({ model: 'claude-opus-5-5' });

    expect(agent.model).toBe('claude-opus-5-5');
    expect(agent.name).toBe('reviewer');
  });

  it('uses claude as the default provider and accepts the others', () => {
    expect(Agent.create(valid).provider).toBe('claude');
    expect(Agent.create({ ...valid, provider: 'copilot' }).provider).toBe(
      'copilot',
    );
  });

  it('rejects an unknown provider', () => {
    expect(() =>
      Agent.create({ ...valid, provider: 'gpt' as unknown as 'claude' }),
    ).toThrow(DomainError);
  });

  it('changes the provider on update', () => {
    const agent = Agent.create(valid);
    agent.update({ provider: 'antigravity', model: 'gemini-3.8-flash-medium' });
    expect(agent.provider).toBe('antigravity');
  });

  it('uses the tools of its module by default', () => {
    expect(Agent.create(valid).module).toBe('pr-review');
    expect(Agent.create({ ...valid, module: 'planner' }).allowedTools).toEqual([
      'Read',
      'Grep',
      'Glob',
      'Bash(git log:*)',
      'Bash(git show:*)',
    ]);
  });

  it('rejects a tool that its module does not allow', () => {
    expect(() =>
      Agent.create({
        ...valid,
        module: 'planner',
        allowedTools: ['Bash(git diff:*)'],
      }),
    ).toThrow(DomainError);
  });
});
