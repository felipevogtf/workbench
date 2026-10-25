import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentsApi } from '../../data-access/agents.api';
import { Agent, AgentLevel, AgentModule } from '../../models/agent';
import { AgentListPage } from './agent-list-page';

function agent(id: string, extra: Partial<Agent> = {}): Agent {
  return {
    id,
    name: `agent-${id}`,
    systemPrompt: 'Revisa',
    module: 'pr-review',
    provider: 'claude',
    model: 'claude-sonnet-5-5',
    allowedTools: ['Read'],
    isDefault: false,
    displayName: null,
    avatar: null,
    effort: null,
    level: null,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
    ...extra,
  };
}

const worker = (id: string, displayName: string, module: AgentModule, extra: Partial<Agent> = {}) =>
  agent(id, { displayName, module, ...extra });

const level = (value: AgentLevel) => ({ level: value });

const TEAM = [
  worker('doc', 'Doc', 'pr-review', { isDefault: true, effort: 'medium' }),
  worker('kiwi', 'Kiwi', 'task-developer', { ...level('medium'), effort: 'medium' }),
  worker('david', 'David', 'task-developer', {
    ...level('complex'),
    isDefault: true,
    effort: 'high',
  }),
  worker('rebecca', 'Rebecca', 'task-developer', {
    ...level('simple'),
    model: 'claude-haiku-4-5-20251001',
    effort: 'low',
  }),
  worker('lucy', 'Lucy', 'task-tickets', { isDefault: true, model: 'claude-opus-5-5' }),
  worker('faraday', 'Faraday', 'planner', { isDefault: true }),
];

describe('AgentListPage', () => {
  async function render(agents: Agent[]) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AgentsApi, useValue: { list: () => of(agents) } }],
    });
    const fixture = TestBed.createComponent(AgentListPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const rows = (element: HTMLElement) =>
    [...element.querySelectorAll('tbody tr')].map((row) =>
      row.querySelector('.who__name')?.textContent?.trim(),
    );

  const rowOf = (element: HTMLElement, name: string) =>
    [...element.querySelectorAll('tbody tr')].find((row) => row.textContent?.includes(name))!;

  async function pick(fixture: Awaited<ReturnType<typeof render>>, id: string, value: string) {
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      `#${id}`,
    )!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('is titled «Trabajadores» and lists every agent in one table', async () => {
    const element: HTMLElement = (await render(TEAM)).nativeElement;

    expect(element.querySelector('h3')?.textContent).toContain('Trabajadores');
    expect(rows(element)).toHaveLength(6);
    expect(element.querySelector('.count')?.textContent).toContain('6 de 6');
  });

  it('shows the avatar, the name, the module, the model and the effort of each one', async () => {
    const element: HTMLElement = (await render(TEAM)).nativeElement;
    const row = rowOf(element, 'Rebecca');

    expect(row.querySelector('app-avatar')).not.toBeNull();
    expect(row.textContent).toContain('Desarrollador');
    expect(row.textContent).toContain('claude-haiku-4-5-20251001');
    expect(row.textContent).toContain('Bajo');
  });

  it('puts the chip of the ticket level only on the developers', async () => {
    const element: HTMLElement = (await render(TEAM)).nativeElement;
    const chips = (name: string) =>
      rowOf(element, name).querySelectorAll('.chips app-badge').length;

    expect(chips('Rebecca')).toBe(2); // el módulo y el nivel
    expect(chips('Doc')).toBe(1); // solo el módulo
    expect(chips('Lucy')).toBe(1);
  });

  it('sorts the workers of the tasks first, and the developers from the lowest level', async () => {
    const element: HTMLElement = (await render(TEAM)).nativeElement;

    expect(rows(element)).toEqual(['Lucy', 'Rebecca', 'Kiwi', 'David', 'Doc', 'Faraday']);
  });

  it('keeps the technical name below the display name, and shows it alone without one', async () => {
    const element: HTMLElement = (await render([agent('x'), TEAM[0]])).nativeElement;

    expect(element.textContent).toContain('agent-x');
    // Solo el que tiene nombre para mostrar lleva el técnico debajo.
    expect(element.querySelectorAll('tbody .who__tech')).toHaveLength(1);
  });

  it('marks the default one and does not let it be deleted', async () => {
    const element: HTMLElement = (await render(TEAM)).nativeElement;
    const row = rowOf(element, 'David');

    expect(row.textContent).toContain('Por defecto');
    expect(row.querySelector<HTMLButtonElement>('button[tone="danger"]')?.disabled).toBe(true);
  });

  describe('the filters', () => {
    it('by module', async () => {
      const fixture = await render(TEAM);
      await pick(fixture, 'filter-module', 'task-developer');

      expect(rows(fixture.nativeElement)).toEqual(['Rebecca', 'Kiwi', 'David']);
      expect(fixture.nativeElement.querySelector('.count').textContent).toContain('3 de 6');
    });

    it('by the ticket level they take', async () => {
      const fixture = await render(TEAM);
      await pick(fixture, 'filter-level', 'simple');

      expect(rows(fixture.nativeElement)).toEqual(['Rebecca']);
    });

    it('by model', async () => {
      const fixture = await render(TEAM);
      await pick(fixture, 'filter-model', 'claude-opus-5-5');

      expect(rows(fixture.nativeElement)).toEqual(['Lucy']);
    });

    it('by effort, where «automático» means the ones without one', async () => {
      const fixture = await render(TEAM);
      await pick(fixture, 'filter-effort', 'high');
      expect(rows(fixture.nativeElement)).toEqual(['David']);

      await pick(fixture, 'filter-effort', 'auto');
      expect(rows(fixture.nativeElement)).toEqual(['Lucy', 'Faraday']);
    });

    it('by name, ignoring accents and case', async () => {
      const fixture = await render([...TEAM, worker('jose', 'José', 'chat')]);
      const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        '#filter-search',
      )!;
      input.value = 'JOSE';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rows(fixture.nativeElement)).toEqual(['José']);
    });

    it('combine, and can be cleared', async () => {
      const fixture = await render(TEAM);
      await pick(fixture, 'filter-module', 'task-developer');
      await pick(fixture, 'filter-effort', 'medium');
      expect(rows(fixture.nativeElement)).toEqual(['Kiwi']);

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.count__clear')!
        .click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(rows(fixture.nativeElement)).toHaveLength(6);
      expect(fixture.nativeElement.querySelector('.count__clear')).toBeNull();
    });

    it('says so when none matches', async () => {
      const fixture = await render(TEAM);
      await pick(fixture, 'filter-module', 'chat');

      expect(fixture.nativeElement.querySelector('app-empty-state')?.textContent).toContain(
        'Ningún trabajador coincide',
      );
      expect(rows(fixture.nativeElement)).toHaveLength(0);
    });
  });

  it('shows an empty state with a call to action when there are no workers', async () => {
    const element: HTMLElement = (await render([])).nativeElement;

    expect(element.querySelector('app-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('Todavía no hay trabajadores');
    expect(element.querySelector('form.filters')).toBeNull();
  });
});
