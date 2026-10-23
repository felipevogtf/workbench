import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { ExecutionsApi } from '../../data-access/executions.api';
import { createdRunner, runner } from '../../testing/factories';
import { RunnersPage } from './runners-page';

describe('RunnersPage', () => {
  let api: Record<
    'listRunners' | 'createRunner' | 'deleteRunner' | 'setDefaultRunner',
    ReturnType<typeof vi.fn>
  >;
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    ask = vi.fn(() => Promise.resolve(true));
    api = {
      listRunners: vi.fn(() => of([])),
      createRunner: vi.fn(() => of(createdRunner('b'))),
      deleteRunner: vi.fn(() => of(undefined)),
      setDefaultRunner: vi.fn(),
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

  async function render() {
    const fixture = TestBed.createComponent(RunnersPage);
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    return fixture;
  }

  it('invites to create the first runner', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    expect(element.textContent).toContain('Todavía no hay runners');
  });

  it('lists the runners and whether each one is connected', async () => {
    api.listRunners.mockReturnValue(
      of([
        runner('a', { name: 'Mi PC', online: true }),
        runner('b', { name: 'Portátil', online: false, lastSeenAt: null }),
      ]),
    );
    const element = (await render()).nativeElement as HTMLElement;

    const rows = Array.from(element.querySelectorAll('.runners li'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Mi PC');
    expect(rows[0].textContent).toContain('Conectado');
    expect(rows[1].textContent).toContain('Portátil');
    expect(rows[1].textContent).toContain('Desconectado');
    expect(rows[1].textContent).toContain('todavía no se conectó');
  });

  it('marks the default runner and lets the user choose another', async () => {
    api.listRunners.mockReturnValue(
      of([runner('a', { name: 'Mi PC', isDefault: true }), runner('b', { name: 'Portátil' })]),
    );
    api.setDefaultRunner.mockReturnValue(
      of([runner('a', { name: 'Mi PC' }), runner('b', { name: 'Portátil', isDefault: true })]),
    );
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    let rows = Array.from(element.querySelectorAll('.runners li'));
    expect(rows[0].textContent).toContain('Predeterminado');
    expect(rows[0].textContent).not.toContain('Usar por defecto');
    expect(rows[1].textContent).toContain('Usar por defecto');

    (rows[1].querySelector('button') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();

    expect(api.setDefaultRunner).toHaveBeenCalledWith('b');
    rows = Array.from(element.querySelectorAll('.runners li'));
    expect(rows[0].textContent).toContain('Usar por defecto');
    expect(rows[1].textContent).toContain('Predeterminado');
  });

  it('shows the token of a new runner once, with the configuration to paste', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    await (
      fixture.componentInstance as unknown as { create(name: string): Promise<boolean> }
    ).create('Mi PC');
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();

    expect(api.createRunner).toHaveBeenCalledWith('Mi PC');
    expect(element.querySelector('.created__token')?.textContent).toContain('wbr_secreto');
    const snippet = element.querySelector('.snippet')?.textContent ?? '';
    expect(JSON.parse(snippet)).toMatchObject({
      token: 'wbr_secreto',
      serverUrl: `${location.origin}/api`,
    });

    (element.querySelector('.created__actions button:last-child') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();
    expect(element.querySelector('.created__token')).toBeNull();
  });

  it('asks before revoking a runner and then revokes it', async () => {
    api.listRunners.mockReturnValue(of([runner('a', { name: 'Mi PC' })]));
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    (element.querySelector('.runner button[aria-label^="Revocar"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    await fixture.whenStable();

    expect(ask).toHaveBeenCalled();
    expect(api.deleteRunner).toHaveBeenCalledWith('a');
    expect(element.querySelector('.runners')).toBeNull();
  });

  it('does not revoke when the user changes their mind', async () => {
    ask.mockResolvedValue(false);
    api.listRunners.mockReturnValue(of([runner('a')]));
    const fixture = await render();

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.runner button[aria-label^="Revocar"]',
      ) as HTMLButtonElement
    ).click();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.deleteRunner).not.toHaveBeenCalled();
  });
});
