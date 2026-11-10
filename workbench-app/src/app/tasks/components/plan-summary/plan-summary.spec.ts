import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlansStore } from '../../data-access/plans.store';
import { Plan } from '../../models/plan';
import { PlanSummary } from './plan-summary';

const ready = {
  id: 'p1',
  status: 'ready',
  agentName: 'default-planner',
  createdAt: '2026-10-06T12:00:00Z',
} as Plan;

describe('PlanSummary', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  });

  function render(store: Partial<Record<keyof PlansStore, unknown>>) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PlansStore,
          useValue: {
            viewed: signal(null),
            viewedContent: signal(null),
            active: signal(null),
            requesting: signal(false),
            latestFailed: signal(null),
            ...store,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PlanSummary);
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, fixture };
  }

  it('says there is a plan without opening it, and opens the preview on demand', async () => {
    const { element, fixture } = render({
      viewed: signal(ready),
      viewedContent: signal('# Objetivo\n\nHacer algo.'),
    });
    const dialog = element.querySelector('dialog') as HTMLDialogElement;

    expect(element.textContent).toContain('Plan de ejecución');
    expect(dialog.open).toBe(false);

    (element.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Hacer algo.');
  });

  it('shows nothing when there is no plan yet', () => {
    expect(render({}).element.textContent?.trim()).toBe('');
  });
});
