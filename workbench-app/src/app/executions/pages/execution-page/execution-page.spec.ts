import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentsApi } from '../../../ai-agents/data-access/agents.api';
import { Agent } from '../../../ai-agents/models/agent';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { ExecutionsApi } from '../../data-access/executions.api';
import { ExecutionDetail } from '../../models/execution';
import { detail, execution, job, ticket } from '../../testing/factories';
import { ExecutionPage } from './execution-page';

function agent(id: string, module: Agent['module'], displayName: string, isDefault = true): Agent {
  return {
    id,
    name: `default-${module}`,
    systemPrompt: 'x',
    module,
    provider: 'claude',
    model: 'm',
    allowedTools: [],
    isDefault,
    displayName,
    avatar: null,
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
  };
}

const AGENTS = [
  agent('ag-tk', 'task-tickets', 'Lucy'),
  agent('ag-dev', 'task-developer', 'David'),
  agent('ag-rev', 'task-reviewer', 'Maine'),
];

describe('ExecutionPage', () => {
  let api: Record<'get' | 'logs' | 'cancel' | 'retry', ReturnType<typeof vi.fn>>;
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    ask = vi.fn(() => Promise.resolve(true));
    api = {
      get: vi.fn(() => of(detail('e1', 'running'))),
      logs: vi.fn((id: string) => of({ logs: `registro de ${id}`, status: 'done' })),
      cancel: vi.fn(() => of(execution('e1', 'cancelled'))),
      retry: vi.fn(() => of(execution('e1', 'running'))),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ExecutionsApi, useValue: api },
        { provide: AgentsApi, useValue: { list: () => of(AGENTS) } },
        { provide: ConfirmDialog, useValue: { ask } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render(value: ExecutionDetail) {
    api.get.mockReturnValue(of(value));
    const fixture = TestBed.createComponent(ExecutionPage);
    fixture.componentRef.setInput('id', 'e1');
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    return fixture;
  }

  const headerButtons = (element: HTMLElement) =>
    [...element.querySelectorAll('app-page-header button, app-page-header a')].map((el) =>
      el.textContent?.trim(),
    );

  /** Una ejecución con un ticket en cada columna, trabajada por los tres agentes. */
  const busy = () =>
    detail('e1', 'running', {
      tickets: [
        ticket('a', { title: 'Uno', status: 'done' }),
        ticket('b', { title: 'Dos', status: 'reviewing' }),
        ticket('c', { title: 'Tres', status: 'developing' }),
        ticket('d', { title: 'Cuatro' }),
      ],
      jobs: [
        job('jt', { kind: 'tickets', agentId: 'ag-tk' }),
        job('ja', {
          kind: 'review',
          ticketId: 'a',
          agentId: 'ag-rev',
          review: { approved: true, summary: 'Bien', issues: [] },
        }),
        job('jb', { kind: 'review', ticketId: 'b', status: 'running', agentId: 'ag-rev' }),
        job('jc', {
          kind: 'develop',
          ticketId: 'c',
          status: 'running',
          agentId: 'ag-dev',
          output: null,
        }),
      ],
    });

  describe('the header', () => {
    it('can only be cancelled while it runs', async () => {
      const element: HTMLElement = (await render(detail('e1', 'running'))).nativeElement;

      expect(headerButtons(element)).toContain('Cancelar');
      expect(headerButtons(element)).not.toContain('Reintentar');
    });

    it('asks before cancelling and then cancels', async () => {
      const element: HTMLElement = (await render(detail('e1', 'running'))).nativeElement;

      (
        [...element.querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) =>
          b.textContent?.includes('Cancelar'),
        ) as HTMLButtonElement
      ).click();
      await vi.advanceTimersByTimeAsync(0);

      expect(ask).toHaveBeenCalled();
      expect(api.cancel).toHaveBeenCalledWith('e1');
    });

    it('does not cancel when the user changes their mind', async () => {
      ask.mockResolvedValue(false);
      const element: HTMLElement = (await render(detail('e1', 'running'))).nativeElement;

      (
        [...element.querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) =>
          b.textContent?.includes('Cancelar'),
        ) as HTMLButtonElement
      ).click();
      await vi.advanceTimersByTimeAsync(0);

      expect(api.cancel).not.toHaveBeenCalled();
    });

    it('offers to retry a failed one, and explains why it failed', async () => {
      const element: HTMLElement = (
        await render(detail('e1', 'failed', { error: 'git clone failed' }))
      ).nativeElement;

      expect(headerButtons(element)).toContain('Reintentar');
      expect(element.textContent).toContain('La ejecución falló');
      expect(element.textContent).toContain('git clone failed');

      (
        [...element.querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) =>
          b.textContent?.includes('Reintentar'),
        ) as HTMLButtonElement
      ).click();
      await vi.advanceTimersByTimeAsync(0);
      expect(api.retry).toHaveBeenCalledWith('e1');
    });

    it('links to the pull request when it is done', async () => {
      const element: HTMLElement = (
        await render(
          detail('e1', 'completed', { pullRequestUrl: 'https://bitbucket.org/acme/web/pull/7' }),
        )
      ).nativeElement;

      expect(element.querySelector('app-page-header a[href*="pull/7"]')).not.toBeNull();
    });

    it('warns when no runner is connected', async () => {
      const element: HTMLElement = (
        await render(detail('e1', 'running', { waitingForRunner: true }))
      ).nativeElement;

      expect(element.textContent).toContain('Esperando un runner');
      expect(element.querySelector('a[href="/executions/runners"]')).not.toBeNull();
    });
  });

  describe('the summary', () => {
    it('says where it is, how many tickets are done and the state of each stage', async () => {
      const element: HTMLElement = (await render(busy())).nativeElement;

      expect(element.querySelector('.summary__activity')?.textContent).toContain(
        'Ticket 2 de 4: En revisión',
      );
      expect(element.querySelector('.summary__count')?.textContent).toContain(
        '1 de 4 tickets hechos',
      );
      expect(element.querySelector('.progress')?.getAttribute('aria-valuenow')).toBe('1');
      expect(
        [...element.querySelectorAll('.steps li')].map((s) => s.getAttribute('data-status')),
      ).toEqual(['running', 'pending', 'pending', 'pending']);
    });

    it('says what happened when it is over', async () => {
      const done: HTMLElement = (await render(detail('e1', 'completed'))).nativeElement;
      expect(done.querySelector('.summary__activity')?.textContent).toContain(
        'pull request está abierta',
      );
    });
  });

  describe('the board', () => {
    it('shows each ticket in its column with the worker that has it', async () => {
      const element: HTMLElement = (await render(busy())).nativeElement;

      const worker = (status: string) =>
        element.querySelector(`[data-status="${status}"] .card__worker`)?.textContent?.trim();
      expect(worker('developing')).toBe('David');
      expect(worker('reviewing')).toBe('Maine');
      expect(worker('done')).toBe('Maine');
      expect(worker('pending')).toBe('Irá con David');
    });

    it('explains there are no tickets yet while they are being created', async () => {
      const element: HTMLElement = (await render(detail('e1', 'running', { tickets: [] })))
        .nativeElement;

      expect(element.querySelector('app-ticket-board')).toBeNull();
      expect(element.textContent).toContain('crear los tickets');
    });
  });

  describe('the side panel', () => {
    const open = async (fixture: Awaited<ReturnType<typeof render>>, title: string) => {
      const card = [
        ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.card'),
      ].find((c) => c.textContent?.includes(title)) as HTMLButtonElement;
      card.click();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();
    };

    it('is closed until a ticket is opened', async () => {
      const element: HTMLElement = (await render(busy())).nativeElement;

      expect(element.querySelector('app-ticket-panel')).toBeNull();
    });

    it('opens the ticket with its detail and loads the log of its last job', async () => {
      const fixture = await render(busy());
      await open(fixture, 'Tres');
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector('.panel__title')?.textContent).toContain('Tres');
      expect(element.querySelector('.panel__worker')?.textContent).toContain('David');
      expect(api.logs).toHaveBeenCalledWith('jc');
    });

    it('tells the story of the ticket in the activity tab, with the names of the workers', async () => {
      const fixture = await render(busy());
      await open(fixture, 'Uno');
      const element: HTMLElement = fixture.nativeElement;

      (
        [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) =>
          t.textContent?.includes('Actividad'),
        ) as HTMLButtonElement
      ).click();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();

      const story = element.querySelector('.timeline')?.textContent ?? '';
      expect(story).toContain('Lucy creó los tickets');
      expect(story).toContain('Maine aprobó el ticket');
    });

    it('opens the general log, which is about creating the tickets and publishing, not about a ticket', async () => {
      const fixture = await render(busy());
      (fixture.nativeElement.querySelector('.summary__link') as HTMLButtonElement).click();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector('.panel__title')?.textContent).toContain('Registro general');
      expect([...element.querySelectorAll('[role="tab"]')]).toHaveLength(1);
      expect(element.querySelectorAll('.job')).toHaveLength(1);
      expect(api.logs).toHaveBeenCalledWith('jt');
    });

    it('closes', async () => {
      const fixture = await render(busy());
      await open(fixture, 'Tres');

      (fixture.nativeElement.querySelector('.backdrop') as HTMLButtonElement).click();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('app-ticket-panel')).toBeNull();
    });
  });
});
