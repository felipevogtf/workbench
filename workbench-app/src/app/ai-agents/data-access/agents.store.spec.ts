import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { Agent } from '../models/agent';
import { AgentsApi } from './agents.api';
import { AgentsStore } from './agents.store';

function agent(id: string, isDefault = false): Agent {
  return {
    id,
    name: `agent-${id}`,
    systemPrompt: 'Revisa',
    module: 'pr-review',
    provider: 'claude',
    model: 'claude-sonnet-5-5',
    allowedTools: ['Read'],
    isDefault,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
  };
}

describe('AgentsStore', () => {
  let api: Record<
    'list' | 'get' | 'create' | 'update' | 'remove' | 'setDefault',
    ReturnType<typeof vi.fn>
  >;
  let store: AgentsStore;
  let toast: Toast;

  beforeEach(() => {
    api = {
      list: vi.fn(() => of([agent('a', true), agent('b')])),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      setDefault: vi.fn(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: AgentsApi, useValue: api }] });
    store = TestBed.inject(AgentsStore);
    toast = TestBed.inject(Toast);
  });

  it('loads once and exposes the default agent', async () => {
    await store.load();
    await store.load();

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.agents()).toHaveLength(2);
    expect(store.defaultAgentOf('pr-review')?.id).toBe('a');
  });

  it('reloads when forced', async () => {
    await store.load();
    await store.load(true);

    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('moves the default flag to the chosen agent', async () => {
    await store.load();
    api.setDefault.mockReturnValue(of(agent('b', true)));

    await store.setDefault('b');

    expect(store.agents().map((a) => [a.id, a.isDefault])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('keeps the agent and shows the backend message when it cannot be deleted', async () => {
    await store.load();
    api.remove.mockReturnValue(
      throwError(() => new Error('No se puede borrar el agente por defecto')),
    );

    const removed = await store.remove('a');

    expect(removed).toBe(false);
    expect(store.agents()).toHaveLength(2);
    expect(toast.messages()[0]).toMatchObject({
      tone: 'danger',
      message: 'No se puede borrar el agente por defecto',
    });
  });

  it('adds a created agent and removes a deleted one', async () => {
    await store.load();
    api.create.mockReturnValue(of(agent('c')));
    api.remove.mockReturnValue(of(undefined));

    await store.create({
      name: 'c',
      systemPrompt: 'p',
      module: 'pr-review',
      provider: 'claude',
      model: 'm',
      allowedTools: [],
    });
    expect(store.agents()).toHaveLength(3);

    await store.remove('c');
    expect(store.agents()).toHaveLength(2);
  });

  it('keeps one default per module', async () => {
    api.list.mockReturnValue(
      of([agent('a', true), { ...agent('p', true), module: 'planner' as const }, agent('b')]),
    );
    api.setDefault.mockReturnValue(of(agent('b', true)));
    await store.load();

    await store.setDefault('b');

    expect(store.defaultAgentOf('pr-review')?.id).toBe('b');
    expect(store.defaultAgentOf('planner')?.id).toBe('p');
  });
});
