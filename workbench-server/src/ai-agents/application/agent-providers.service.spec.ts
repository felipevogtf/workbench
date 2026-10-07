import { NotFoundException } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { AgentProvider } from '@ai-agents/domain/providers';
import { AgentProvidersService } from './agent-providers.service';

describe('AgentProvidersService', () => {
  const build = (disabled: AgentProvider[] = []) => {
    const off = new Set(disabled);
    const service = new AgentProvidersService(
      {
        list: () => [
          { id: 'claude', label: 'Claude', models: ['a'] },
          { id: 'copilot', label: 'Copilot', models: ['b'] },
          { id: 'antigravity', label: 'Antigravity', models: ['c'] },
        ],
      },
      {
        findDisabled: () => Promise.resolve([...off]),
        setEnabled: (provider, enabled) => {
          if (enabled) off.delete(provider);
          else off.add(provider);
          return Promise.resolve();
        },
      },
    );
    return service;
  };

  it('lists every provider, enabled unless disabled', async () => {
    const list = await build(['copilot']).list();
    expect(list.map((p) => [p.id, p.enabled])).toEqual([
      ['claude', true],
      ['copilot', false],
      ['antigravity', true],
    ]);
  });

  it('disables and enables a provider', async () => {
    const service = build();
    const afterOff = await service.setEnabled('copilot', false);
    expect(afterOff.find((p) => p.id === 'copilot')?.enabled).toBe(false);
    const afterOn = await service.setEnabled('copilot', true);
    expect(afterOn.find((p) => p.id === 'copilot')?.enabled).toBe(true);
  });

  it('keeps at least one provider enabled', async () => {
    const service = build(['copilot', 'antigravity']);
    await expect(service.setEnabled('claude', false)).rejects.toThrow(
      DomainError,
    );
  });

  it('rejects an unknown provider', async () => {
    await expect(build().setEnabled('nope', false)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to use a disabled provider', async () => {
    const service = build(['antigravity']);
    await expect(service.assertEnabled('antigravity')).rejects.toThrow(
      DomainError,
    );
    await expect(service.assertEnabled('claude')).resolves.toBeUndefined();
  });
});
