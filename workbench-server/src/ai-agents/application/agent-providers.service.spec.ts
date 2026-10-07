import { DomainError } from '@core/domain/domain.error';
import { AgentProvidersService } from './agent-providers.service';

describe('AgentProvidersService', () => {
  const service = new AgentProvidersService({
    list: () => [
      { id: 'claude', label: 'Claude', models: ['a'], enabled: true },
      { id: 'copilot', label: 'Copilot', models: ['b'], enabled: false },
    ],
  });

  it('lists the providers with their state', () => {
    expect(service.list().map((p) => [p.id, p.enabled])).toEqual([
      ['claude', true],
      ['copilot', false],
    ]);
  });

  it('accepts an enabled provider and refuses a disabled one', () => {
    expect(() => service.assertEnabled('claude')).not.toThrow();
    expect(() => service.assertEnabled('copilot')).toThrow(DomainError);
  });

  it('refuses a provider that is not in the catalog', () => {
    expect(() => service.assertEnabled('antigravity')).toThrow(DomainError);
  });
});
