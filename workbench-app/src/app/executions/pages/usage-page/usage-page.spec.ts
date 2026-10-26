import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ExecutionsApi } from '../../data-access/executions.api';
import { UsageOverview } from '../../models/usage';
import { UsagePage } from './usage-page';

const NOW = Date.now();
const soon = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

function overview(extra: Partial<UsageOverview> = {}): UsageOverview {
  return {
    current: {
      fiveHour: { used: 0.25, resetsAt: soon(265) },
      sevenDay: { used: 0.04, resetsAt: soon(60 * 24 * 5) },
      takenAt: new Date(NOW - 120_000).toISOString(),
      ageSeconds: 120,
    },
    refreshing: false,
    calibration: {
      fiveHour: { costPerPoint: null, samples: 0 },
      sevenDay: { costPerPoint: null, samples: 0 },
    },
    days: [
      {
        date: '2026-10-25',
        tokens: 1000,
        costUsd: 0.4,
        byKind: { develop: 1000 },
        estimatedPoints: null,
      },
      {
        date: '2026-10-26',
        tokens: 500,
        costUsd: 0.2,
        byKind: { review: 500 },
        estimatedPoints: null,
      },
    ],
    today: { tokens: 500, costUsd: 0.2, estimatedPoints: null },
    week: { tokens: 1500, costUsd: 0.6, estimatedPoints: null },
    ...extra,
  };
}

describe('UsagePage', () => {
  let api: { usage: ReturnType<typeof vi.fn>; refreshUsage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      usage: vi.fn(() => of(overview())),
      refreshUsage: vi.fn(() => of({ requested: true })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: ExecutionsApi, useValue: api }] });
  });

  async function render() {
    const fixture = TestBed.createComponent(UsagePage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the two windows of the plan with what is used, what is left and when each restarts', async () => {
    const element: HTMLElement = (await render()).nativeElement;

    const meters = [...element.querySelectorAll('app-usage-meter')].map(
      (meter) => meter.textContent,
    );
    expect(meters[0]).toContain('25 % usado');
    expect(meters[0]).toContain('te queda 75 %');
    expect(meters[1]).toContain('4 % usado');
    expect(element.querySelector('app-usage-meter .meter__until')?.textContent).toContain('4 h');
  });

  it('says how old the measure is and that the percentage is of the whole account', async () => {
    const element: HTMLElement = (await render()).nativeElement;

    expect(element.querySelector('.freshness')?.textContent).toContain('Medido hace 2 min');
    expect(element.querySelector('.freshness')?.textContent).toContain(
      'todo lo que usas con Claude',
    );
  });

  it('shows what the Workbench spent today and in the last 7 days, in exact tokens', async () => {
    const element: HTMLElement = (await render()).nativeElement;

    const summary = element.querySelector('.summary')?.textContent ?? '';
    expect(summary).toContain('500 tokens');
    expect(summary).toContain('1.500 tokens');
  });

  it('draws the spending of each day', async () => {
    const element: HTMLElement = (await render()).nativeElement;

    expect(element.querySelectorAll('app-usage-chart .chart__col')).toHaveLength(2);
  });

  it('says the percentage will be estimated later, and offers no switch, until it can calibrate', async () => {
    const element: HTMLElement = (await render()).nativeElement;

    expect(element.querySelector('.note')?.textContent).toContain('al menos 2 ejecuciones medidas');
    expect(element.querySelector('app-segmented-control')).toBeNull();
  });

  it('offers to see the chart as an estimated share of the week once it can calibrate', async () => {
    api.usage.mockReturnValue(
      of(
        overview({
          calibration: {
            fiveHour: { costPerPoint: 0.15, samples: 3 },
            sevenDay: { costPerPoint: 0.3, samples: 3 },
          },
          today: { tokens: 500, costUsd: 0.2, estimatedPoints: 0.7 },
        }),
      ),
    );

    const element: HTMLElement = (await render()).nativeElement;

    expect(element.querySelector('app-segmented-control')).not.toBeNull();
    expect(element.querySelector('.summary')?.textContent).toContain('≈ 0,7 % de la semana');
    expect(element.querySelector('.note')?.textContent).toContain('estimación');
  });

  it('asks for a new measure when the user presses «Actualizar»', async () => {
    const fixture = await render();
    const refresh = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      (button as HTMLElement).textContent?.includes('Actualizar'),
    ) as HTMLButtonElement;

    refresh.click();
    await fixture.whenStable();

    expect(api.refreshUsage).toHaveBeenCalled();
  });

  it('asks for a new measure by itself when the last one is old', async () => {
    api.usage.mockReturnValue(
      of(overview({ current: { ...overview().current, ageSeconds: 3 * 3600 } })),
    );

    const fixture = await render();

    expect(api.refreshUsage).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.freshness')?.classList).toContain('is-stale');
  });

  it('does not ask by itself when the measure is recent', async () => {
    await render();

    expect(api.refreshUsage).not.toHaveBeenCalled();
  });

  it('says it is waiting for the runner while a new measure is on its way', async () => {
    api.usage.mockReturnValue(of(overview({ refreshing: true })));

    const element: HTMLElement = (await render()).nativeElement;

    expect(element.querySelector('.freshness')?.textContent).toContain('Pidiendo una medida nueva');
  });

  it('explains how to get a first measure when there is none', async () => {
    api.usage.mockReturnValue(
      of(
        overview({
          current: { fiveHour: null, sevenDay: null, takenAt: null, ageSeconds: null },
        }),
      ),
    );

    const element: HTMLElement = (await render()).nativeElement;

    expect(element.querySelector('app-empty-state')?.textContent).toContain(
      'Todavía no hay una medida del plan',
    );
    expect(element.querySelector('app-usage-meter')).toBeNull();
  });

  it('shows the error when the consumption cannot be loaded', async () => {
    api.usage.mockReturnValue(throwError(() => new Error('sin conexión')));

    const element: HTMLElement = (await render()).nativeElement;

    expect(element.querySelector('app-alert')?.textContent).toContain(
      'No se pudo cargar el consumo',
    );
  });
});
