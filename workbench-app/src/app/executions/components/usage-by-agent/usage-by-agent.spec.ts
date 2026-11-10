import { TestBed } from '@angular/core/testing';
import { Agent } from '../../../ai-agents/models/agent';
import { AgentUsage, WindowUsage } from '../../models/usage';
import { UsageByAgent } from './usage-by-agent';

const agent = (id: string, displayName: string | null, name = `agent-${id}`): Agent => ({
  id,
  name,
  systemPrompt: 'x',
  module: 'task-developer',
  provider: 'claude',
  model: 'm',
  allowedTools: [],
  isDefault: false,
  displayName,
  avatar: null,
  createdAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
});

const usage = (
  agentId: string | null,
  agentName: string | null,
  tokens: number,
  points: number | null = null,
): AgentUsage => ({ agentId, agentName, jobs: 2, tokens, costUsd: 0.5, estimatedPoints: points });

async function render(rows: AgentUsage[], agents: Agent[] = []) {
  const fixture = TestBed.createComponent(UsageByAgent);
  fixture.componentRef.setInput('rows', rows);
  fixture.componentRef.setInput('agents', agents);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const cells = (element: HTMLElement, row: number) =>
  [...element.querySelectorAll('tbody tr')[row].querySelectorAll('td')].map((cell) =>
    // En la primera celda va el avatar (su inicial) y el nombre: se lee solo el nombre.
    (cell.querySelector('.who__name') ?? cell).textContent?.replace(/\s+/g, ' ').trim(),
  );

describe('UsageByAgent', () => {
  it('shows each worker with their name, jobs, exact tokens and share of the total', async () => {
    const element = await render(
      [usage('a', 'agent-a', 7500), usage('b', 'agent-b', 2500)],
      [agent('a', 'David'), agent('b', 'Maine')],
    );

    expect(cells(element, 0)).toEqual(['David', '2', '7.500', '75 %', '—']);
    expect(cells(element, 1)).toEqual(['Maine', '2', '2.500', '25 %', '—']);
    expect(element.querySelectorAll('app-avatar')).toHaveLength(2);
  });

  it('shows the estimated share of the week when it has one', async () => {
    const element = await render([usage('a', 'agent-a', 1000, 2.4)], [agent('a', 'David')]);

    expect(cells(element, 0)[4]).toBe('≈ 2,4 %');
  });

  it('groups the jobs without an agent as the upload and measure of the plan', async () => {
    const element = await render([usage(null, null, 300)]);

    expect(cells(element, 0)[0]).toBe('Subida y medición');
    expect(element.querySelector('app-avatar')).toBeNull();
  });

  it('finds a worker whose id changed by the technical name saved in the job', async () => {
    const element = await render(
      [usage('viejo', 'agent-a', 100)],
      [agent('nuevo', 'David', 'agent-a')],
    );

    expect(cells(element, 0)[0]).toBe('David');
  });

  describe('per 5-hour window', () => {
    const NOW = Date.parse('2026-10-26T12:00:00Z');
    const window = (startHour: number, byAgent: Record<string, number>): WindowUsage => {
      const start = Date.parse('2026-10-26T00:00:00Z') + startHour * 3_600_000;
      return {
        date: '2026-10-26',
        startsAt: new Date(start).toISOString(),
        resetsAt: new Date(start + 5 * 3_600_000).toISOString(),
        endsAt: new Date(start + 5 * 3_600_000).toISOString(),
        peak: 0.3,
        measures: 2,
        tokens: 0,
        costUsd: 0,
        byAgent,
      };
    };

    async function renderWith(windows: WindowUsage[]) {
      const fixture = TestBed.createComponent(UsageByAgent);
      fixture.componentRef.setInput('rows', [usage('ag-1', null, 100), usage(null, null, 5)]);
      fixture.componentRef.setInput('windows', windows);
      fixture.componentRef.setInput('now', NOW);
      await fixture.whenStable();
      return fixture.nativeElement as HTMLElement;
    }

    it('shows what each worker spent in the latest windows, the current one first', async () => {
      const element = await renderWith([
        window(2, { 'ag-1': 7000 }),
        window(9, { 'ag-1': 1500, none: 40 }),
      ]);

      const headers = [...element.querySelectorAll('thead th')].map((th) => th.textContent);
      expect(headers[5]).toContain('ahora');
      expect(headers).toHaveLength(7);
      expect(cells(element, 0).slice(5)).toEqual(['1.500', '7.000']);
      // Sin agente: gastó en la ventana de ahora, pero no en la anterior.
      expect(cells(element, 1).slice(5)).toEqual(['40', '—']);
    });

    it('adds no columns when there are no windows', async () => {
      const element = await renderWith([]);

      expect(element.querySelectorAll('thead th')).toHaveLength(5);
    });
  });

  it('says so when the worker no longer exists', async () => {
    const element = await render([usage('x', null, 100)]);

    expect(cells(element, 0)[0]).toBe('Un trabajador que ya no está');
  });
});
