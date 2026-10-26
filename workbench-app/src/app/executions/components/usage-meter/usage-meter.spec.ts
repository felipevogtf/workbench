import { TestBed } from '@angular/core/testing';
import { UsageMeter } from './usage-meter';

const NOW = Date.parse('2026-10-26T00:00:00Z');

async function render(used: number | null) {
  const fixture = TestBed.createComponent(UsageMeter);
  fixture.componentRef.setInput('title', 'Ventana de 5 horas');
  fixture.componentRef.setInput('now', NOW);
  fixture.componentRef.setInput(
    'window',
    used === null ? null : { used, resetsAt: new Date(NOW + 265 * 60_000).toISOString() },
  );
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('UsageMeter', () => {
  it('shows how much is used, how much is left and when it restarts', async () => {
    const element = await render(0.24);

    expect(element.textContent).toContain('24 % usado');
    expect(element.textContent).toContain('te queda 76 %');
    expect(element.textContent).toContain('en 4 h 25 min');
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('24');
    expect(element.querySelector<HTMLElement>('.meter__fill')?.style.width).toBe('24%');
  });

  it('changes its level as it gets close to the limit', async () => {
    expect((await render(0.5)).querySelector('.meter')?.getAttribute('data-level')).toBe('ok');
    expect((await render(0.75)).querySelector('.meter')?.getAttribute('data-level')).toBe(
      'warning',
    );
    expect((await render(0.95)).querySelector('.meter')?.getAttribute('data-level')).toBe('danger');
  });

  it('never goes past the bar when the plan says more than 100 %', async () => {
    const element = await render(1.2);

    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '100',
    );
    expect(element.textContent).toContain('te queda 0 %');
  });

  it('says there is no data yet', async () => {
    const element = await render(null);

    expect(element.textContent).toContain('Sin datos todavía');
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
  });
});
