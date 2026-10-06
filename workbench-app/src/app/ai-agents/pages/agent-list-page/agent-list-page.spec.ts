import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentsApi } from '../../data-access/agents.api';
import { Agent } from '../../models/agent';
import { AgentListPage } from './agent-list-page';

function agent(id: string, isDefault = false): Agent {
  return {
    id,
    name: `agent-${id}`,
    systemPrompt: 'Revisa',
    model: 'claude-sonnet-5-5',
    allowedTools: ['Read'],
    isDefault,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
  };
}

describe('AgentListPage', () => {
  async function render(agents: Agent[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AgentsApi, useValue: { list: () => of(agents) } }],
    });
    const fixture = TestBed.createComponent(AgentListPage);
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
});
