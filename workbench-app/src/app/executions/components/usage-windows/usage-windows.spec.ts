import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WindowUsage } from '../../models/usage';
import { UsageWindows } from './usage-windows';

const NOW = Date.parse('2026-10-26T12:00:00Z');

function window(startHour: number, extra: Partial<WindowUsage> = {}): WindowUsage {
  const start = Date.parse('2026-10-26T00:00:00Z') + startHour * 3_600_000;
  return {
    date: '2026-10-26',
    startsAt: new Date(start).toISOString(),
    resetsAt: new Date(start + 5 * 3_600_000).toISOString(),
    peak: 0.4,
    measures: 3,
    tokens: 12_000,
    costUsd: 1,
    ...extra,
  };
}

describe('UsageWindows', () => {
  let fixture: ComponentFixture<UsageWindows>;

  function render(windows: WindowUsage[]): HTMLElement {
    fixture = TestBed.createComponent(UsageWindows);
    fixture.componentRef.setInput('windows', windows);
    fixture.componentRef.setInput('now', NOW);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the newest window first, with the peak and what the Workbench spent', () => {
    const el = render([window(0, { peak: 0.2 }), window(10, { peak: 0.72 })]);

    const rows = el.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('72 %');
    expect(rows[0].textContent).toContain('12.000 tokens');
    expect(rows[1].textContent).toContain('20 %');
  });

  it('marks the window that is going on now', () => {
    const el = render([window(0), window(10)]);

    expect(el.querySelectorAll('.now')).toHaveLength(1);
    expect(el.querySelector('tbody tr')?.classList).toContain('is-current');
  });

  it('says "at least" when there are few measures inside the window', () => {
    const el = render([window(10, { measures: 1 })]);

    expect(el.textContent).toContain('al menos 40 %');
  });
});
