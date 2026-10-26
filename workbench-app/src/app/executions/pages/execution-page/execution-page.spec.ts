import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AgentsApi } from '../../../ai-agents/data-access/agents.api';
import { Agent } from '../../../ai-agents/models/agent';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { ExecutionsApi } from '../../data-access/executions.api';
import { ExecutionDetail } from '../../models/execution';
import { ExecutionUsage } from '../../models/usage';
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
  let api: Record<
    | 'get'
    | 'logs'
    | 'cancel'
    | 'retry'
    | 'begin'
    | 'assign'
    | 'chat'
    | 'answer'
    | 'reopenTicket'
    | 'addTickets'
    | 'requestFinalReview',
    ReturnType<typeof vi.fn>
  >;
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    ask = vi.fn(() => Promise.resolve(true));
    api = {
      get: vi.fn(() => of(detail('e1', 'running'))),
      logs: vi.fn((id: string) => of({ logs: `registro de ${id}`, status: 'done' })),
      cancel: vi.fn(() => of(execution('e1', 'cancelled'))),
      retry: vi.fn(() => of(execution('e1', 'running'))),
      begin: vi.fn(() => of(execution('e1', 'running'))),
      assign: vi.fn(() => of(execution('e1', 'awaiting'))),
      chat: vi.fn(() => of({ reply: 'Va bien' })),
      answer: vi.fn(() => of(execution('e1', 'running'))),
      reopenTicket: vi.fn(() => of(execution('e1', 'running'))),
      addTickets: vi.fn(() => of(execution('e1', 'running'))),
      requestFinalReview: vi.fn(() => of(execution('e1', 'completed'))),
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

  describe('jobs from before the agent id was saved', () => {
    it('are still shown with their worker, found by the technical name of the agent', async () => {
      const element: HTMLElement = (
        await render(
          detail('e1', 'running', {
            tickets: [ticket('c', { title: 'Tres', status: 'developing' })],
            jobs: [
              job('jc', {
                kind: 'develop',
                ticketId: 'c',
                status: 'running',
                agentId: null,
                agentName: 'default-task-developer',
              }),
            ],
          }),
        )
      ).nativeElement;

      expect(
        element.querySelector('[data-status="developing"] .card__worker')?.textContent?.trim(),
      ).toBe('David');
    });
  });

  describe('the chat with Lucy', () => {
    it('is the avatar of Lucy on a button, and it answers about this execution', async () => {
      const fixture = await render(detail('e1', 'running', { tickets: [ticket('a')] }));
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector('app-execution-chat .fab app-avatar')).not.toBeNull();
      expect(element.querySelector('app-execution-chat .fab')?.getAttribute('aria-label')).toBe(
        'Abrir el chat con Lucy',
      );

      (element.querySelector('app-execution-chat .fab') as HTMLButtonElement).click();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(element.textContent).toContain('Habla con Lucy');
    });
  });

  describe('what the execution spent', () => {
    const spent = (extra: Partial<ExecutionUsage> = {}) =>
      detail('e1', 'completed', {
        usage: {
          tokens: { input: 100, output: 200, cacheWrite: 3000, cacheRead: 400000, total: 403300 },
          costUsd: 1.2,
          measured: { fiveHour: null, sevenDay: null },
          estimatedPoints: { fiveHour: null, sevenDay: null },
          ...extra,
        },
      });

    it('shows the exact tokens in the summary', async () => {
      const fixture = await render(spent());

      expect(fixture.nativeElement.querySelector('.summary__usage')?.textContent).toContain(
        '403.300 tokens',
      );
    });

    it('adds the share of the plan it estimates, and what the bar rose when it was measured', async () => {
      const fixture = await render(
        spent({
          estimatedPoints: { fiveHour: 6.2, sevenDay: 0.8 },
          measured: { fiveHour: { from: 0.24, to: 0.31, delta: 0.07 }, sevenDay: null },
        }),
      );
      const text =
        (fixture.nativeElement as HTMLElement).querySelector('.summary')?.textContent ?? '';

      expect(text).toContain('≈ 6,2 % de tu ventana de 5 h');
      expect(text).toContain('≈ 0,8 % de la semana');
      expect(text).toContain('del 24 % al 31 %');
    });

    it('says nothing for an execution from before it was measured', async () => {
      const fixture = await render(detail('e1', 'completed'));

      expect(fixture.nativeElement.querySelector('.summary__usage')).toBeNull();
    });
  });

  describe('a ticket that waits for an answer', () => {
    const waiting = () =>
      detail('e1', 'running', {
        tickets: [
          ticket('a', {
            title: 'Banner de conexión',
            status: 'waiting',
            question: {
              id: 'q1',
              from: 'David',
              agentId: 'ag-dev',
              text: '¿Todas las pantallas o solo el formulario?',
              recommendation: 'Recomiendo todas las pantallas.',
              askedAt: '2026-10-26T00:00:00Z',
            },
          }),
        ],
        jobs: [job('jt', { kind: 'tickets', agentId: 'ag-tk' })],
      });

    it('shows the question to the user, with the recommendation of Lucy, and a column of its own', async () => {
      const fixture = await render(waiting());
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector('app-ticket-questions')?.textContent).toContain(
        '¿Todas las pantallas o solo el formulario?',
      );
      expect(element.querySelector('app-ticket-questions')?.textContent).toContain(
        'Recomiendo todas las pantallas.',
      );
      expect(element.querySelector('[data-status="waiting"] .card')).not.toBeNull();
    });

    it('sends the answer of the user to that ticket', async () => {
      const fixture = await render(waiting());
      const element: HTMLElement = fixture.nativeElement;
      const box = element.querySelector('app-ticket-questions textarea') as HTMLTextAreaElement;

      box.value = 'Solo en el formulario.';
      (element.querySelector('app-ticket-questions form') as HTMLFormElement).dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await vi.advanceTimersByTimeAsync(0);

      expect(api.answer).toHaveBeenCalledWith('e1', 'a', 'Solo en el formulario.');
    });

    it('shows nothing of the sort when no ticket is waiting', async () => {
      const fixture = await render(detail('e1', 'running', { tickets: [ticket('a')] }));

      expect(fixture.nativeElement.querySelector('app-ticket-questions')).toBeNull();
    });
  });

  describe('while it waits for the go-ahead', () => {
    const awaiting = () =>
      detail('e1', 'awaiting', {
        tickets: [
          ticket('a', { title: 'Uno', developerId: 'ag-dev', reviewerId: 'ag-rev' }),
          ticket('b', { title: 'Dos', developerId: 'ag-dev', reviewerId: 'ag-rev' }),
        ],
        jobs: [job('jt', { kind: 'tickets', agentId: 'ag-tk' })],
      });

    it('shows the assignment of the tickets instead of the board, with a button to start', async () => {
      const fixture = await render(awaiting());
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector('app-ticket-assignment')).not.toBeNull();
      expect(element.querySelector('app-ticket-board')).toBeNull();
      expect(element.textContent).toContain('Esperando tu visto bueno');
      expect(headerButtons(element)).toContain('Empezar el desarrollo');
      expect(headerButtons(element)).toContain('Cancelar');
    });

    it('starts the development when the user gives the go-ahead', async () => {
      const fixture = await render(awaiting());
      const start = [...fixture.nativeElement.querySelectorAll('app-page-header button')].find(
        (button) => (button as HTMLElement).textContent?.includes('Empezar'),
      ) as HTMLButtonElement;

      start.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(api.begin).toHaveBeenCalledWith('e1');
    });

    it('sends nothing when the picked worker is the one the ticket already has', async () => {
      const fixture = await render(awaiting());
      const select = fixture.nativeElement.querySelector(
        'select[aria-label="Revisor del ticket 2"]',
      ) as HTMLSelectElement;
      select.value = 'ag-rev';
      select.dispatchEvent(new Event('change'));
      await vi.advanceTimersByTimeAsync(0);

      // El revisor ya era ese: no se manda nada.
      expect(api.assign).not.toHaveBeenCalled();
    });
  });

  describe('a task with several repositories', () => {
    const target = (name: string, pullRequestUrl: string | null, primary = false) => ({
      repo: {
        url: `https://bitbucket.org/acme/${name}`,
        host: 'bitbucket.org',
        fullName: `acme/${name}`,
        sshUrl: `git@bitbucket.org:acme/${name}.git`,
      },
      branch: 'workbench/tarea-e1',
      baseBranch: pullRequestUrl ? 'main' : null,
      pullRequestUrl,
      primary,
    });

    const multi = (urls: [string | null, string | null]) =>
      detail('e1', 'completed', {
        repos: [target('web', urls[0], true), target('app', urls[1])],
        pullRequestUrl: urls[0],
        tickets: [
          ticket('a', { title: 'API', status: 'done', repo: 'acme/web' }),
          ticket('b', { title: 'Pantalla', status: 'done', repo: 'acme/app' }),
        ],
        jobs: [job('jt', { kind: 'tickets', agentId: 'ag-tk' })],
      });

    it('says in which repository each ticket is developed', async () => {
      const fixture = await render(multi([null, null]));
      const element: HTMLElement = fixture.nativeElement;

      const badges = [...element.querySelectorAll('.card')].map((card) =>
        card.querySelector('app-badge')?.textContent?.trim(),
      );
      expect(badges).toEqual(['web', 'app']);
      expect(element.textContent).toContain('2 repositorios');
    });

    it('offers one link to a pull request per repository that already has one', async () => {
      const fixture = await render(multi(['https://pr/web', 'https://pr/app']));

      const links = [
        ...fixture.nativeElement.querySelectorAll('app-page-header a[href^="https://pr/"]'),
      ];
      expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
        ['PR de web', 'https://pr/web'],
        ['PR de app', 'https://pr/app'],
      ]);
    });

    it('does not label the tickets nor change the link when there is a single repository', async () => {
      const fixture = await render(
        detail('e1', 'completed', {
          pullRequestUrl: 'https://pr/web',
          repos: [target('web', 'https://pr/web', true)],
          tickets: [ticket('a', { title: 'API', status: 'done' })],
        }),
      );
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector('.card app-badge')).toBeNull();
      expect(headerButtons(element)).toContain('Abrir la PR');
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

  describe('correcting a finished execution', () => {
    const finding = {
      severity: 'high' as const,
      file: 'docker/nginx/dsy.conf',
      issue: 'La ruta /ea no existe',
      suggestion: 'Usar /secured/admin/ea',
    };
    const review = (extra: Record<string, unknown> = {}) => ({
      status: 'done',
      requestedAt: '2026-10-26T10:00:00Z',
      finishedAt: '2026-10-26T10:05:00Z',
      summary: 'Falta cubrir una parte del plan',
      findings: [finding],
      error: null,
      ...extra,
    });
    const completed = (extra: Record<string, unknown> = {}) =>
      detail('e1', 'completed', {
        tickets: [ticket('a', { title: 'Uno', status: 'done' })],
        ...extra,
      } as never);
    const press = (element: HTMLElement, text: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes(text))!
        .click();

    it('offers the final review once the execution is completed, and not while it runs', async () => {
      const finished: HTMLElement = (await render(completed())).nativeElement;
      expect(finished.querySelector('app-final-review-panel')).not.toBeNull();

      const running: HTMLElement = (await render(busy())).nativeElement;
      expect(running.querySelector('app-final-review-panel')).toBeNull();
    });

    it('asks for the final review when the user presses the button', async () => {
      const fixture = await render(completed());

      press(fixture.nativeElement, 'Pedir la revisión final');
      await vi.advanceTimersByTimeAsync(0);

      expect(api.requestFinalReview).toHaveBeenCalledWith('e1');
    });

    it('shows the report once it arrives, and keeps showing it for a failed review', async () => {
      const done: HTMLElement = (await render(completed({ finalReview: review() }))).nativeElement;
      expect(done.textContent).toContain('Falta cubrir una parte del plan');
      expect(done.textContent).toContain('La ruta /ea no existe');

      const failed: HTMLElement = (
        await render(completed({ finalReview: review({ status: 'failed', error: 'sin runner' }) }))
      ).nativeElement;
      expect(failed.textContent).toContain('sin runner');
    });

    it('turns a finding into a correction ticket', async () => {
      const fixture = await render(completed({ finalReview: review() }));

      press(fixture.nativeElement, 'Corregir con un ticket');
      await vi.advanceTimersByTimeAsync(0);

      expect(api.addTickets).toHaveBeenCalledWith('e1', [
        {
          title: 'Corregir: La ruta /ea no existe',
          description:
            'La ruta /ea no existe\n\nQué cambiar: Usar /secured/admin/ea\n\nArchivo: docker/nginx/dsy.conf',
          level: 'medium',
          files: ['docker/nginx/dsy.conf'],
        },
      ]);
    });

    it('reopens a done ticket from its panel with the note', async () => {
      const fixture = await render(completed());
      const card = fixture.nativeElement.querySelector('.card') as HTMLButtonElement;
      card.click();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();

      const box = fixture.nativeElement.querySelector('.note-form textarea') as HTMLTextAreaElement;
      box.value = 'Cambia la ruta';
      press(fixture.nativeElement, 'Reabrir el ticket con esta nota');
      await vi.advanceTimersByTimeAsync(0);

      expect(api.reopenTicket).toHaveBeenCalledWith('e1', 'a', 'Cambia la ruta');
    });

    it('does not offer to reopen a ticket while the execution is still running', async () => {
      const fixture = await render(busy());
      const element: HTMLElement = fixture.nativeElement;
      const card = [...element.querySelectorAll<HTMLButtonElement>('.card')].find((each) =>
        each.textContent?.includes('Uno'),
      ) as HTMLButtonElement;
      card.click();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).not.toContain('Reabrir el ticket con esta nota');
    });
  });
});
