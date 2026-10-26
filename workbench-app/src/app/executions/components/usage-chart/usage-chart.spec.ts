import { TestBed } from '@angular/core/testing';
import { DayUsage } from '../../models/usage';
import { UsageChart } from './usage-chart';

const day = (
  date: string,
  tokens: number,
  byKind: Record<string, number>,
  points: number | null = null,
): DayUsage => ({
  date,
  tokens,
  costUsd: 0,
  byKind,
  estimatedPoints: points,
});

const DAYS = [
  day('2026-10-24', 0, {}),
  day('2026-10-25', 1000, { develop: 750, review: 250 }, 2),
  day('2026-10-26', 500, { tickets: 500 }, 1),
];

async function render(unit: 'tokens' | 'points' = 'tokens') {
  const fixture = TestBed.createComponent(UsageChart);
  fixture.componentRef.setInput('days', DAYS);
  fixture.componentRef.setInput('unit', unit);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('UsageChart', () => {
  it('draws a bar per day, with the biggest at full height', async () => {
    const element = await render();

    const heights = [...element.querySelectorAll<HTMLElement>('.chart__bar')].map(
      (bar) => bar.style.height,
    );
    expect(heights).toEqual(['0%', '100%', '50%']);
    expect(element.querySelector('.chart__max')?.textContent).toContain('1.000 tokens');
  });

  it('stacks each bar by stage, in proportion', async () => {
    const element = await render();
    const bar = element.querySelectorAll('.chart__bar')[1];

    const parts = [...bar.querySelectorAll<HTMLElement>('.chart__part')].map((part) => [
      part.dataset['kind'],
      part.style.flexGrow,
    ]);
    expect(parts).toEqual([
      ['develop', '0.75'],
      ['review', '0.25'],
    ]);
  });

  it('labels each day and names the stages in the legend', async () => {
    const element = await render();

    expect(
      [...element.querySelectorAll('.chart__label')].map((l) => l.textContent?.trim()),
    ).toEqual(['24/10', '25/10', '26/10']);
    expect(element.querySelector('.chart__legend')?.textContent).toContain('Desarrollo');
  });

  it('shows the estimated points of the week instead, in one color, when asked', async () => {
    const element = await render('points');

    expect(element.querySelector('.chart__max')?.textContent).toContain('≈ 2 %');
    expect(element.querySelector('.chart__legend')).toBeNull();
    const heights = [...element.querySelectorAll<HTMLElement>('.chart__bar')].map(
      (b) => b.style.height,
    );
    expect(heights).toEqual(['0%', '100%', '50%']);
  });

  it('keeps a table with the same data for whoever cannot see the bars', async () => {
    const element = await render();

    const rows = [...element.querySelectorAll('table tbody tr')].map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(rows[1]).toContain('2026-10-25');
    expect(rows[1]).toContain('1.000');
    expect(element.querySelector('.chart__plot')?.getAttribute('aria-label')).toContain(
      '1.500 tokens',
    );
  });

  it('does not break with no spending at all', async () => {
    const fixture = TestBed.createComponent(UsageChart);
    fixture.componentRef.setInput('days', [day('2026-10-26', 0, {})]);
    await fixture.whenStable();

    const bar = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.chart__bar');

    expect(bar?.style.height).toBe('0%');
  });

  it('explains why it is empty when no day has measured spending, and not otherwise', async () => {
    const full = await render();
    expect(full.querySelector('.chart__none')).toBeNull();

    const fixture = TestBed.createComponent(UsageChart);
    fixture.componentRef.setInput('days', [day('2026-10-26', 0, {})]);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.chart__none')?.textContent,
    ).toContain('no guardaban los tokens');
  });
});
