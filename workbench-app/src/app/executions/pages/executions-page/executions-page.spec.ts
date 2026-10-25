import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ExecutionsApi } from '../../data-access/executions.api';
import { ExecutionListItem } from '../../models/execution';
import { listItem, ticket } from '../../testing/factories';
import { ExecutionsPage } from './executions-page';

describe('ExecutionsPage', () => {
  let api: { listAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    api = { listAll: vi.fn(() => of([])) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ExecutionsApi, useValue: api }],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render(items: ExecutionListItem[]): Promise<HTMLElement> {
    api.listAll.mockReturnValue(of(items));
    const fixture = TestBed.createComponent(ExecutionsPage);
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const titles = (element: HTMLElement, section: string) =>
    Array.from(element.querySelectorAll(`[aria-labelledby="${section}"] .row__title`)).map((a) =>
      a.textContent?.trim(),
    );

  it('explains where executions come from when there are none yet', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('Todavía no hay ejecuciones');
    expect(element.querySelector('.rows')).toBeNull();
  });

  it('shows what is running apart from the history', async () => {
    const element = await render([
      listItem('c', 'running', { issueName: 'Tipografía' }),
      listItem('b', 'completed', { issueName: 'Paleta' }),
      listItem('a', 'failed', { issueName: 'Botones' }),
    ]);

    expect(element.querySelector('#running-title')?.textContent).toContain('En curso (1)');
    expect(titles(element, 'running-title')).toEqual(['Tipografía']);
    expect(titles(element, 'history-title')).toEqual(['Paleta', 'Botones']);
  });

  it('has no «en curso» section when nothing is running', async () => {
    const element = await render([listItem('b', 'completed')]);

    expect(element.querySelector('#running-title')).toBeNull();
    expect(element.querySelector('#history-title')).not.toBeNull();
  });

  it('says where a running execution is', async () => {
    const element = await render([
      listItem('c', 'running', {
        tickets: [ticket('a', { status: 'done' }), ticket('b', { status: 'reviewing' })],
      }),
    ]);

    expect(element.querySelector('.row__progress')?.textContent).toContain(
      'Ticket 2 de 2: En revisión',
    );
    expect(element.querySelector('.row .badge, .row app-badge')?.textContent).toContain('En curso');
  });

  it('shows why a failed one failed, and how many tickets a finished one did', async () => {
    const element = await render([
      listItem('b', 'completed', {
        tickets: [ticket('a', { status: 'done' }), ticket('b', { status: 'done' })],
      }),
      listItem('a', 'failed', { error: 'El revisor sigue pidiendo cambios' }),
    ]);

    const rows = Array.from(element.querySelectorAll('.row'));
    expect(rows[0].textContent).toContain('2 de 2 tickets hechos');
    expect(rows[1].querySelector('.row__error')?.textContent).toContain('sigue pidiendo cambios');
  });

  it('links each execution, and its pull request when it has one', async () => {
    const element = await render([
      listItem('b', 'completed', { pullRequestUrl: 'https://bitbucket.org/acme/web/pull/7' }),
      listItem('a', 'failed'),
    ]);

    const rows = Array.from(element.querySelectorAll('.row'));
    expect(rows[0].querySelector('a[href="/executions/b"]')).not.toBeNull();
    expect(rows[0].querySelector('a[href*="pull/7"]')).not.toBeNull();
    expect(rows[1].querySelector('a[href*="pull/"]')).toBeNull();
  });

  it('names the task of every execution, even when it was deleted', async () => {
    const element = await render([listItem('a', 'failed', { issueName: null })]);

    expect(element.querySelector('.row__title')?.textContent).toContain('Tarea eliminada');
  });
});
