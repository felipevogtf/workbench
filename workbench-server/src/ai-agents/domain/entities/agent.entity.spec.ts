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
});
