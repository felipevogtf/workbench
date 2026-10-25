import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentsApi } from '../../data-access/agents.api';
import { Agent } from '../../models/agent';
import { AgentCard } from './agent-card';

const base: Agent = {
  id: 'a',
  name: 'default-task-developer',
  systemPrompt: 'Desarrollas',
  module: 'task-developer',
  provider: 'claude',
  model: 'claude-sonnet-5-5',
  allowedTools: ['Read'],
  isDefault: true,
  createdAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
};

describe('AgentCard', () => {
  async function render(agent: Agent): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AgentsApi, useValue: { providers: () => of([]) } }],
    });
    const fixture = TestBed.createComponent(AgentCard);
    fixture.componentRef.setInput('agent', agent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the technical name when the agent has no display name, and no avatar', async () => {
    const element = await render(base);

    expect(element.querySelector('.agent__name')?.textContent).toBe('default-task-developer');
    expect(element.querySelector('.agent__tech')).toBeNull();
    expect(element.querySelector('app-avatar')).toBeNull();
  });

  it('shows the display name with an avatar, and the technical name below', async () => {
    const element = await render({ ...base, displayName: 'David' });

    expect(element.querySelector('.agent__name')?.textContent).toBe('David');
    expect(element.querySelector('.agent__tech')?.textContent).toBe('default-task-developer');
    expect(element.querySelector('app-avatar')?.textContent?.trim()).toBe('D');
  });

  it('uses the image of the agent when it has one', async () => {
    const element = await render({
      ...base,
      displayName: 'David',
      avatar: 'data:image/png;base64,AAAA',
    });

    expect(element.querySelector('app-avatar img')?.getAttribute('src')).toBe(
      'data:image/png;base64,AAAA',
    );
  });
});
