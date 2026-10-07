import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimeEntriesStore } from '../../data-access/time-entries.store';
import { HoursPanel } from './hours-panel';

describe('HoursPanel', () => {
  function render(estimated: number | null = null, error: string | null = null) {
    const store = {
      error: signal(error),
      days: signal([
        {
          date: '2026-10-05',
          hours: 3,
          entries: [
            { id: 'e1', hours: 1, date: '2026-10-05' },
            { id: 'e2', hours: 2, date: '2026-10-05' },
          ],
        },
      ]),
      totalHours: signal(3),
      add: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    };
    TestBed.configureTestingModule({ providers: [{ provide: TimeEntriesStore, useValue: store }] });
    const fixture = TestBed.createComponent(HoursPanel);
    fixture.componentRef.setInput('estimatedHours', estimated);
    return { fixture, store, root: fixture.nativeElement as HTMLElement };
  }

  it('lists the days and the total, with the estimate when there is one', async () => {
    const { fixture, root } = render(8);
    await fixture.whenStable();

    expect(root.querySelectorAll('.entries li')).toHaveLength(2);
    expect(root.querySelector('.total')?.textContent).toContain('estimadas');
  });

  it('omits the estimate when the task has none', async () => {
    const { fixture, root } = render(null);
    await fixture.whenStable();

    expect(root.querySelector('.total')?.textContent).not.toContain('estimadas');
  });

  it('shows the loading error instead of the list', async () => {
    const { fixture, root } = render(null, 'No hay conexión');
    await fixture.whenStable();

    expect(root.textContent).toContain('No hay conexión');
    expect(root.querySelector('.days')).toBeNull();
  });

  it('does not register hours outside 0.25–24', async () => {
    const { fixture, store, root } = render();
    await fixture.whenStable();

    const amount = root.querySelector<HTMLInputElement>('#hours-amount')!;
    amount.value = '30';
    amount.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(store.add).not.toHaveBeenCalled();
  });

  it('registers valid hours for the chosen day', async () => {
    const { fixture, store, root } = render();
    await fixture.whenStable();

    const amount = root.querySelector<HTMLInputElement>('#hours-amount')!;
    amount.value = '1.5';
    amount.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(store.add).toHaveBeenCalledWith(1.5, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
