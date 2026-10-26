import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { createdRunner, runner } from '../testing/factories';
import { ExecutionsApi } from './executions.api';
import { RunnersStore } from './runners.store';

describe('RunnersStore', () => {
  let api: Record<
    'listRunners' | 'createRunner' | 'deleteRunner' | 'setDefaultRunner',
    ReturnType<typeof vi.fn>
  >;
  let store: RunnersStore;
  let toast: Toast;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listRunners: vi.fn(() => of([runner('a', { online: false })])),
      createRunner: vi.fn(() => of(createdRunner('b'))),
      deleteRunner: vi.fn(() => of(undefined)),
      setDefaultRunner: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [RunnersStore, { provide: ExecutionsApi, useValue: api }],
    });
    store = TestBed.inject(RunnersStore);
    toast = TestBed.inject(Toast);
  });

  afterEach(() => {
    store.stopPolling();
    vi.useRealTimers();
  });

  it('lists the runners', async () => {
    await store.load();

    expect(store.runners().map((r) => r.id)).toEqual(['a']);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('notices when a runner connects', async () => {
    await store.load();
    expect(store.runners()[0].online).toBe(false);

    api.listRunners.mockReturnValue(of([runner('a', { online: true })]));
    await vi.advanceTimersByTimeAsync(5100);

    expect(store.runners()[0].online).toBe(true);
  });

  it('shows why it could not load', async () => {
    api.listRunners.mockReturnValue(throwError(() => new Error('sin red')));

    await store.load();

    expect(store.error()).toContain('sin red');
    expect(store.loaded()).toBe(false);
  });

  it('creates a runner and keeps its token on view without keeping it in the list', async () => {
    await store.load();

    expect(await store.create('Mi PC')).toBe(true);

    expect(api.createRunner).toHaveBeenCalledWith('Mi PC');
    expect(store.created()?.token).toBe('wbr_secreto');
    expect(store.runners().map((r) => r.id)).toEqual(['a', 'b']);
    expect(JSON.stringify(store.runners())).not.toContain('wbr_secreto');

    store.dismissCreated();
    expect(store.created()).toBeNull();
  });

  it('tells the user when it could not create the runner', async () => {
    const error = vi.spyOn(toast, 'error');
    api.createRunner.mockReturnValue(throwError(() => new Error('The runner needs a name')));

    expect(await store.create('')).toBe(false);

    expect(error).toHaveBeenCalled();
    expect(store.created()).toBeNull();
  });

  it('revokes a runner and drops its token from view', async () => {
    await store.load();
    await store.create('Mi PC');

    await store.remove(runner('b'));

    expect(api.deleteRunner).toHaveBeenCalledWith('b');
    expect(store.runners().map((r) => r.id)).toEqual(['a']);
    expect(store.created()).toBeNull();
  });

  it('chooses the default runner with what the server answers', async () => {
    api.listRunners.mockReturnValue(of([runner('a', { isDefault: true }), runner('b')]));
    await store.load();
    api.setDefaultRunner.mockReturnValue(of([runner('a'), runner('b', { isDefault: true })]));

    await store.setDefault(runner('b'));

    expect(api.setDefaultRunner).toHaveBeenCalledWith('b');
    expect(store.runners().map((r) => [r.id, r.isDefault])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('keeps the list as it was when choosing the default fails', async () => {
    api.listRunners.mockReturnValue(of([runner('a', { isDefault: true }), runner('b')]));
    await store.load();
    const error = vi.spyOn(toast, 'error');
    api.setDefaultRunner.mockReturnValue(throwError(() => new Error('boom')));

    await store.setDefault(runner('b'));

    expect(error).toHaveBeenCalled();
    expect(store.runners().find((r) => r.isDefault)?.id).toBe('a');
  });

  it('reads again which one is the default when the default one is revoked', async () => {
    api.listRunners.mockReturnValue(of([runner('a', { isDefault: true }), runner('b')]));
    await store.load();
    api.listRunners.mockReturnValue(of([runner('b', { isDefault: true })]));

    await store.remove(runner('a', { isDefault: true }));

    expect(store.runners().map((r) => [r.id, r.isDefault])).toEqual([['b', true]]);
  });

  it('keeps the runner when revoking fails', async () => {
    await store.load();
    const error = vi.spyOn(toast, 'error');
    api.deleteRunner.mockReturnValue(throwError(() => new Error('boom')));

    await store.remove(runner('a'));

    expect(error).toHaveBeenCalled();
    expect(store.runners().map((r) => r.id)).toEqual(['a']);
  });
});
