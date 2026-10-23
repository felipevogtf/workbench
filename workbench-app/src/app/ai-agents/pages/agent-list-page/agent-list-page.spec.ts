import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentsApi } from '../../data-access/agents.api';
import { Agent, AgentModule, AgentScope } from '../../models/agent';
import { AgentListPage } from './agent-list-page';

function agent(id: string, isDefault = false, module: AgentModule = 'pr-review'): Agent {
  return {
    id,
    name: `agent-${id}`,
    systemPrompt: 'Revisa',
    module,
    provider: 'claude',
    model: 'claude-sonnet-5-5',
    allowedTools: ['Read'],
    isDefault,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
  };
}

describe('AgentListPage', () => {
  async function render(agents: Agent[], scope?: AgentScope): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AgentsApi, useValue: { list: () => of(agents) } }],
    });
    const fixture = TestBed.createComponent(AgentListPage);
    if (scope) fixture.componentRef.setInput('scope', scope);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the header and one card per agent', async () => {
    const element = await render([agent('a', true), agent('b')]);

    expect(element.querySelector('h3')?.textContent).toContain('Agentes de IA');
    expect(element.querySelectorAll('app-agent-card')).toHaveLength(2);
  });

  it('marks the default agent and disables its delete button', async () => {
    const element = await render([agent('a', true)]);

    expect(element.textContent).toContain('Por defecto');
    const remove = element.querySelector<HTMLButtonElement>('button[tone="danger"]');
    expect(remove?.disabled).toBe(true);
  });

  it('shows an empty state with a call to action when there are no agents', async () => {
    const element = await render([]);

    expect(element.querySelector('app-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('Todavía no hay agentes');
  });

  describe('the two agent menus', () => {
    const mixed = () => [
      agent('pr', true, 'pr-review'),
      agent('chat', true, 'chat'),
      agent('t', true, 'task-tickets'),
      agent('d', true, 'task-developer'),
      agent('r', true, 'task-reviewer'),
    ];
    const names = (element: HTMLElement) =>
      [...element.querySelectorAll('app-agent-card')].map((card) => card.textContent);

    it('«Agentes de IA» does not show the agents of the workers', async () => {
      const element = await render(mixed());

      expect(element.querySelector('h3')?.textContent).toContain('Agentes de IA');
      expect(element.querySelectorAll('app-agent-card')).toHaveLength(2);
      expect(names(element).join()).toContain('agent-pr');
      expect(names(element).join()).not.toContain('agent-d');
    });

    it('«Trabajadores» shows only the agents of the workers, under their own names', async () => {
      const element = await render(mixed(), 'workers');

      expect(element.querySelector('h3')?.textContent).toContain('Trabajadores');
      expect(element.querySelectorAll('app-agent-card')).toHaveLength(3);
      expect(names(element).join()).not.toContain('agent-pr');
      expect(
        [...element.querySelectorAll('.group__title')].map((t) => t.textContent?.trim()),
      ).toEqual(['Creador de tickets', 'Desarrollador', 'Revisor']);
    });

    it('shows the empty state of a menu when only the other one has agents', async () => {
      const element = await render([agent('pr', true, 'pr-review')], 'workers');

      expect(element.querySelector('app-empty-state')).not.toBeNull();
      expect(element.querySelectorAll('app-agent-card')).toHaveLength(0);
    });
  });
});
