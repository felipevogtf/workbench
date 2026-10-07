import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ResourceStore } from './resource-store';

interface Item {
  id: string;
}

@Injectable()
class TestStore extends ResourceStore<Item> {
  fetch: () => Observable<Item[]> = () => of([{ id: 'a' }]);
  readonly list = () => this.items();

  protected fetchAll() {
    return this.fetch();
  }

  put(item: Item) {
    this.add(item);
  }
  swap(item: Item) {
    this.replace(item);
  }
  remove(id: string) {
    this.drop(id);
  }
}

describe('ResourceStore', () => {
  let store: TestStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TestStore] });
    store = TestBed.inject(TestStore);
  });

  it('loads once and only reloads when forced', async () => {
    const fetch = vi.fn(() => of([{ id: 'a' }]));
    store.fetch = fetch;

    await store.load();
    await store.load();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.loaded()).toBe(true);

    await store.load(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('exposes the error when loading fails and stays not loaded', async () => {
    store.fetch = () => throwError(() => new Error('sin conexión'));

    await store.load();

    expect(store.error()).toBe('sin conexión');
    expect(store.loaded()).toBe(false);
    expect(store.loading()).toBe(false);
  });

  it('keeps the list up to date with add, replace and drop', async () => {
    await store.load();

    store.put({ id: 'b' });
    expect(store.list().map((item) => item.id)).toEqual(['a', 'b']);

    store.swap({ id: 'a', ...{ extra: 1 } } as Item);
    expect(store.list()[0]).toEqual({ id: 'a', extra: 1 });

    store.remove('a');
    expect(store.list().map((item) => item.id)).toEqual(['b']);
  });
});
