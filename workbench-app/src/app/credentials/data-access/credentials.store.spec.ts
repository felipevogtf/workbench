import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { CredentialGroup, CredentialItem } from '../models/credential';
import { CredentialsApi } from './credentials.api';
import { CredentialsStore, REVEAL_TIMEOUT_MS } from './credentials.store';

const user: CredentialItem = { id: 'u', key: 'usuario', sensitive: false, value: 'felipe' };
const pass: CredentialItem = { id: 'p', key: 'pass', sensitive: true, value: null };

function group(id: string, items: CredentialItem[] = [user, pass], category: string | null = null) {
  return {
    id,
    name: `grupo-${id}`,
    category,
    items,
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
  } satisfies CredentialGroup;
}

describe('CredentialsStore', () => {
  let api: Record<
    'list' | 'create' | 'update' | 'remove' | 'addItem' | 'updateItem' | 'removeItem' | 'reveal',
    ReturnType<typeof vi.fn>
  >;
  let store: CredentialsStore;
  let toast: Toast;

  beforeEach(() => {
    api = {
      list: vi.fn(() => of([group('a', [user, pass], 'nube'), group('b', [], 'nube')])),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(() => of(undefined)),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      removeItem: vi.fn(),
      reveal: vi.fn(() => of({ value: 's3cret' })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: CredentialsApi, useValue: api }] });
    store = TestBed.inject(CredentialsStore);
    toast = TestBed.inject(Toast);
  });

  afterEach(() => vi.useRealTimers());

  it('loads once and lists the categories in use without repeats', async () => {
    await store.load();
    await store.load();

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.groups()).toHaveLength(2);
    expect(store.categories()).toEqual(['nube']);
  });

  it('adds a created group and replaces the one an item operation returns', async () => {
    await store.load();
    api.create.mockReturnValue(of(group('c')));
    api.addItem.mockReturnValue(of(group('b', [user])));

    await store.create({ name: 'nuevo' });
    await store.addItem('b', { key: 'usuario', value: 'felipe' });

    expect(store.groups().map((g) => g.id)).toEqual(['a', 'b', 'c']);
    expect(store.groups()[1].items).toEqual([user]);
  });

  it('lets the caller handle a failed save', async () => {
    api.create.mockReturnValue(throwError(() => new Error('boom')));

    await expect(store.create({ name: 'x' })).rejects.toThrow('boom');
    expect(store.groups()).toEqual([]);
  });

  it('asks the server for a sensitive value only when it is shown, then hides it', async () => {
    await store.load();

    await store.toggleReveal('a', pass);
    expect(store.revealed().get('p')).toBe('s3cret');
    expect(api.reveal).toHaveBeenCalledWith('a', 'p');

    await store.toggleReveal('a', pass);
    expect(store.revealed().has('p')).toBe(false);
    expect(api.reveal).toHaveBeenCalledTimes(1);
  });

  it('hides a revealed value by itself after a while', async () => {
    vi.useFakeTimers();
    await store.toggleReveal('a', pass);

    vi.advanceTimersByTime(REVEAL_TIMEOUT_MS);

    expect(store.revealed().has('p')).toBe(false);
  });

  it('forgets a revealed value when its item is edited or removed', async () => {
    await store.load();
    api.updateItem.mockReturnValue(of(group('a', [user, { ...pass, key: 'password' }])));
    api.removeItem.mockReturnValue(of(group('a', [user])));

    await store.toggleReveal('a', pass);
    await store.updateItem('a', 'p', { key: 'password' });
    expect(store.revealed().has('p')).toBe(false);

    await store.toggleReveal('a', pass);
    await store.removeItem('a', 'p');
    expect(store.revealed().has('p')).toBe(false);
  });

  it('copies without revealing a sensitive value', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const success = vi.spyOn(toast, 'success');

    await store.copyValue('a', pass);

    expect(writeText).toHaveBeenCalledWith('s3cret');
    expect(store.revealed().has('p')).toBe(false);
    expect(success).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('copies a plain value without asking the server', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await store.copyValue('a', user);

    expect(writeText).toHaveBeenCalledWith('felipe');
    expect(api.reveal).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('removes a group and its revealed values, or reports the failure', async () => {
    await store.load();
    await store.toggleReveal('a', pass);

    expect(await store.remove('a')).toBe(true);
    expect(store.groups().map((g) => g.id)).toEqual(['b']);
    expect(store.revealed().size).toBe(0);

    api.remove.mockReturnValue(throwError(() => new Error('boom')));
    const error = vi.spyOn(toast, 'error');
    expect(await store.remove('b')).toBe(false);
    expect(error).toHaveBeenCalled();
    expect(store.groups()).toHaveLength(1);
  });
});
