import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HourTotalsStore } from './hour-totals.store';
import { TasksApi } from './tasks.api';

describe('HourTotalsStore', () => {
  let api: { listHourTotals: ReturnType<typeof vi.fn> };
  let store: HourTotalsStore;

  beforeEach(() => {
    api = { listHourTotals: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: TasksApi, useValue: api }] });
    store = TestBed.inject(HourTotalsStore);
  });

  it('exposes the hours logged per task', async () => {
    api.listHourTotals.mockReturnValue(of({ a: 3.5, b: 1 }));

    await store.load();

    expect(store.totals()).toEqual({ a: 3.5, b: 1 });
  });

  it('asks again on every load, because hours change from the task detail', async () => {
    api.listHourTotals.mockReturnValueOnce(of({ a: 1 })).mockReturnValueOnce(of({ a: 2 }));

    await store.load();
    await store.load();

    expect(store.totals()).toEqual({ a: 2 });
  });

  it('shows no totals instead of failing when the request fails', async () => {
    api.listHourTotals.mockReturnValue(throwError(() => new Error('boom')));

    await store.load();

    expect(store.totals()).toEqual({});
  });
});
