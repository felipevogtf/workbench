import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ExecutionsApi } from '../../data-access/executions.api';
import { IssueExecutionsStore } from '../../data-access/issue-executions.store';
import { execution, ticket } from '../../testing/factories';
import { ExecutionPanel } from './execution-panel';

describe('ExecutionPanel', () => {
  let api: Record<'listByIssue' | 'start', ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listByIssue: vi.fn(() => of([])),
      start: vi.fn(() => of(execution('new', 'running'))),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        IssueExecutionsStore,
        { provide: ExecutionsApi, useValue: api },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(IssueExecutionsStore).stopPolling();
    vi.useRealTimers();
  });

  async function render(canRun: boolean): Promise<HTMLElement> {
    await TestBed.inject(IssueExecutionsStore).load('i1');
    const fixture = TestBed.createComponent(ExecutionPanel);
    fixture.componentRef.setInput('issueId', 'i1');
    fixture.componentRef.setInput('canRun', canRun);
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const runButton = (element: HTMLElement) =>
    element.querySelector<HTMLButtonElement>('.exec__actions button')!;

  it('needs a ready plan to run', async () => {
    const element = await render(false);

    expect(runButton(element).disabled).toBe(true);
    expect(element.querySelector('.exec__actions')?.textContent).toContain('necesita un plan');
  });

  it('starts the execution and opens it', async () => {
    const element = await render(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(runButton(element).disabled).toBe(false);
    runButton(element).click();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.start).toHaveBeenCalledWith('i1');
    expect(navigate).toHaveBeenCalledWith(['/executions', 'new']);
  });

  it('shows where a running execution is and does not allow a second one', async () => {
    api.listByIssue.mockReturnValue(
      of([
        execution('run', 'running', {
          tickets: [
            ticket('a', { status: 'done' }),
            ticket('b', { status: 'reviewing' }),
            ticket('c'),
          ],
        }),
      ]),
    );
    const element = await render(true);

    expect(element.querySelector('.exec__progress')?.textContent).toContain(
      'Ticket 2 de 3: En revisión',
    );
    expect(runButton(element).disabled).toBe(true);
  });

  it('says the tickets are being created before there are any', async () => {
    api.listByIssue.mockReturnValue(of([execution('run', 'running')]));
    const element = await render(true);

    expect(element.querySelector('.exec__progress')?.textContent).toContain('Creando los tickets');
  });

  it('lists the previous executions with a link to the pull request', async () => {
    api.listByIssue.mockReturnValue(
      of([
        execution('b', 'completed', {
          tickets: [ticket('a', { status: 'done' })],
          pullRequestUrl: 'https://bitbucket.org/acme/web/pull/7',
        }),
        execution('a', 'failed'),
      ]),
    );
    const element = await render(true);

    const rows = element.querySelectorAll('.exec__list li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Completada');
    expect(rows[0].querySelector<HTMLAnchorElement>('a[href*="pull/7"]')).not.toBeNull();
    expect(rows[1].textContent).toContain('Falló');
  });

  it('only lists the latest few', async () => {
    api.listByIssue.mockReturnValue(
      of(Array.from({ length: 8 }, (_, i) => execution(`e${i}`, 'completed'))),
    );
    const element = await render(true);

    expect(element.querySelectorAll('.exec__list li')).toHaveLength(5);
    expect(element.textContent).toContain('y 3 más antiguas');
  });
});
