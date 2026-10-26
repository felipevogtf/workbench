import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentsApi } from '../../data-access/agents.api';
import { ProviderStatus } from '../../models/agent';
import { AgentFormPage } from './agent-form-page';

const providers: ProviderStatus[] = [
  {
    id: 'claude',
    label: 'Claude',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5'],
    enabled: true,
  },
  { id: 'copilot', label: 'GitHub Copilot', models: ['auto', 'gpt-5'], enabled: true },
  { id: 'antigravity', label: 'Antigravity', models: ['gemini-3.8-flash-medium'], enabled: false },
];

describe('AgentFormPage', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AgentsApi, useValue: { providers: () => of(providers), list: () => of([]) } },
      ],
    });
    const fixture = TestBed.createComponent(AgentFormPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const options = (root: HTMLElement, id: string) =>
    [...root.querySelectorAll<HTMLOptionElement>(`#${id} option`)].map((o) => o.value);

  it('offers only the enabled providers, with the first model preselected', async () => {
    const root: HTMLElement = (await render()).nativeElement;

    expect(options(root, 'agent-provider')).toEqual(['claude', 'copilot']);
    expect(options(root, 'agent-model')).toEqual(['', 'claude-sonnet-5-5', 'claude-opus-5-5']);
    expect(root.querySelector<HTMLSelectElement>('#agent-model')?.value).toBe('claude-sonnet-5-5');
  });

  it('shows the models of the provider that is picked', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;

    const select = root.querySelector<HTMLSelectElement>('#agent-provider')!;
    select.value = 'copilot';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(options(root, 'agent-model')).toEqual(['', 'auto', 'gpt-5']);
    expect(root.querySelector<HTMLSelectElement>('#agent-model')?.value).toBe('auto');
  });

  describe('as a worker', () => {
    it('offers every module, starts on the developer and goes back to the workers', async () => {
      const root: HTMLElement = (await render()).nativeElement;

      expect(options(root, 'agent-module')).toEqual([
        'pr-review',
        'planner',
        'chat',
        'task-chat',
        'task-tickets',
        'task-developer',
        'task-reviewer',
      ]);
      expect(root.querySelector<HTMLSelectElement>('#agent-module')?.value).toBe('task-developer');
      expect(root.querySelector('a[back]')?.getAttribute('href')).toBe('/executions/agents');
      expect(root.textContent).toContain('Nuevo trabajador');
    });
  });
});
