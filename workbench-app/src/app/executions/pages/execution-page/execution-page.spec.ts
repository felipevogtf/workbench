import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { ExecutionsApi } from '../../data-access/executions.api';
import { ExecutionDetail } from '../../models/execution';
import { detail, execution, job, ticket } from '../../testing/factories';
import { ExecutionPage } from './execution-page';

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
        { provide: ConfirmDialog, useValue: { ask } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render(value: ExecutionDetail): Promise<HTMLElement> {
    api.get.mockReturnValue(of(value));
    const fixture = TestBed.createComponent(ExecutionPage);
    fixture.componentRef.setInput('id', 'e1');
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const buttons = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('app-page-header button, app-page-header a')).map((el) =>
      el.textContent?.trim(),
    );

  it('shows the stages with what each one is doing', async () => {
    const element = await render(
      detail('e1', 'running', {
        stages: [
          { key: 'tickets', status: 'done', startedAt: null, finishedAt: null },
          { key: 'develop', status: 'running', startedAt: null, finishedAt: null },
          { key: 'review', status: 'pending', startedAt: null, finishedAt: null },
          { key: 'publish', status: 'pending', startedAt: null, finishedAt: null },
        ],
      }),
    );

    const stages = Array.from(element.querySelectorAll('.stages li'));
    expect(stages.map((s) => s.getAttribute('data-status'))).toEqual([
      'done',
      'running',
      'pending',
      'pending',
    ]);
    expect(stages[1].textContent).toContain('Desarrollo');
  });

  it('can only be cancelled while it runs', async () => {
    const element = await render(detail('e1', 'running'));

    expect(buttons(element)).toContain('Cancelar');
    expect(buttons(element)).not.toContain('Reintentar');
  });

  it('asks before cancelling and then cancels', async () => {
    const element = await render(detail('e1', 'running'));

    Array.from(element.querySelectorAll<HTMLButtonElement>('app-page-header button'))
      .find((button) => button.textContent?.includes('Cancelar'))!
      .click();
    await vi.advanceTimersByTimeAsync(0);

    expect(ask).toHaveBeenCalled();
    expect(api.cancel).toHaveBeenCalledWith('e1');
  });

  it('does not cancel when the user changes their mind', async () => {
    ask.mockResolvedValue(false);
    const element = await render(detail('e1', 'running'));

    Array.from(element.querySelectorAll<HTMLButtonElement>('app-page-header button'))
      .find((button) => button.textContent?.includes('Cancelar'))!
      .click();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.cancel).not.toHaveBeenCalled();
  });

  it('explains a failure and offers to retry from there', async () => {
    const element = await render(detail('e1', 'failed', { error: 'git clone failed' }));

    expect(element.textContent).toContain('La ejecución falló');
    expect(element.textContent).toContain('git clone failed');
    expect(buttons(element)).toContain('Reintentar');
    expect(buttons(element)).not.toContain('Cancelar');

    Array.from(element.querySelectorAll<HTMLButtonElement>('app-page-header button'))
      .find((button) => button.textContent?.includes('Reintentar'))!
      .click();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.retry).toHaveBeenCalledWith('e1');
  });

  it('links to the pull request when it is done', async () => {
    const element = await render(
      detail('e1', 'completed', { pullRequestUrl: 'https://bitbucket.org/acme/web/pull/7' }),
    );

    expect(element.textContent).toContain('Lista para revisar');
    expect(
      element.querySelector<HTMLAnchorElement>('app-page-header a[href*="pull/7"]'),
    ).not.toBeNull();
  });

  it('warns when no runner is connected to do the queued work', async () => {
    const element = await render(detail('e1', 'running', { waitingForRunner: true }));

    expect(element.textContent).toContain('Esperando un runner');
    expect(element.querySelector('a[href="/executions/runners"]')).not.toBeNull();
  });

  it('lists the tickets with their status, criteria and what the reviewer asked for', async () => {
    const element = await render(
      detail('e1', 'running', {
        tickets: [
          ticket('a', {
            title: 'API de órdenes',
            status: 'developing',
            rounds: 1,
            criteria: ['Devuelve 200'],
            feedback: ['Maneja el error 404'],
          }),
          ticket('b', { title: 'Vista', status: 'done', reviewNote: 'Todo bien' }),
        ],
      }),
    );

    const tickets = Array.from(element.querySelectorAll('.tickets > li'));
    expect(tickets).toHaveLength(2);
    expect(tickets[0].textContent).toContain('1. API de órdenes');
    expect(tickets[0].textContent).toContain('Desarrollando');
    expect(tickets[0].textContent).toContain('Devuelve 200');
    expect(tickets[0].textContent).toContain('Maneja el error 404');
    expect(tickets[1].textContent).toContain('Hecho');
    expect(tickets[1].textContent).toContain('Todo bien');
  });

  it('shows the log of the last job and switches to another one when picked', async () => {
    const element = await render(
      detail('e1', 'completed', {
        tickets: [ticket('a', { title: 'API' })],
        jobs: [
          job('j1', { kind: 'tickets' }),
          job('j2', { kind: 'develop', ticketId: 'a', attempt: 2 }),
        ],
      }),
    );

    const items = Array.from(element.querySelectorAll<HTMLButtonElement>('.job'));
    expect(items.map((item) => item.querySelector('.job__title')?.textContent?.trim())).toEqual([
      'Tickets',
      'Desarrollo · API (intento 2)',
    ]);
    expect(element.querySelector('.logs')?.textContent).toBe('registro de j2');

    items[0].click();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.logs).toHaveBeenCalledWith('j1');
    expect(element.querySelector('.logs')?.textContent).toBe('registro de j1');
  });

  it('shows why a job failed', async () => {
    const element = await render(
      detail('e1', 'failed', { jobs: [job('j1', { status: 'failed', error: 'Sin crédito' })] }),
    );

    expect(element.querySelector('.jobs__log')?.textContent).toContain('Sin crédito');
  });
});
