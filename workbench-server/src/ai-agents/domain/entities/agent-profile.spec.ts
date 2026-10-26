import { Agent } from './agent.entity';

const base = {
  name: 'default-task-developer',
  systemPrompt: 'Desarrollas',
  model: 'claude-sonnet-5-5',
  module: 'task-developer' as const,
};

describe('the profile of an agent (name and avatar)', () => {
  it('has none by default: the app shows the technical name and draws an avatar', () => {
    const agent = Agent.create(base);

    expect(agent.displayName).toBeNull();
    expect(agent.avatar).toBeNull();
  });

  it('can be created with a display name and an avatar', () => {
    const agent = Agent.create({
      ...base,
      displayName: '  David ',
      avatar: 'data:image/png;base64,AAAA',
    });

    expect(agent.displayName).toBe('David');
    expect(agent.avatar).toBe('data:image/png;base64,AAAA');
  });

  it('can be changed, and cleared with an empty value', () => {
    const agent = Agent.create({
      ...base,
      displayName: 'David',
      avatar: 'data:image/png;base64,AAAA',
    });

    agent.update({ displayName: 'Rebecca' });
    expect(agent.displayName).toBe('Rebecca');
    expect(agent.avatar).toBe('data:image/png;base64,AAAA');

    agent.update({ displayName: '  ', avatar: '' });
    expect(agent.displayName).toBeNull();
    expect(agent.avatar).toBeNull();
  });

  it('is left as it was when an update does not mention it', () => {
    const agent = Agent.create({ ...base, displayName: 'David' });

    agent.update({ model: 'claude-opus-5-5' });

    expect(agent.displayName).toBe('David');
  });
});
