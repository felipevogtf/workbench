import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AgentsStore } from '@ai-agents/index';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SegmentedControl } from '@shared/ui/segmented-control/segmented-control';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Spinner } from '@shared/ui/spinner/spinner';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { UsageByAgent } from '../../components/usage-by-agent/usage-by-agent';
import { ChartUnit, UsageChart } from '../../components/usage-chart/usage-chart';
import { UsageMeter } from '../../components/usage-meter/usage-meter';
import { UsageStore, USAGE_STALE_SECONDS } from '../../data-access/usage.store';
import { formatPoints, formatTokens } from '../../models/usage';

/**
 * El consumo de Claude: cómo va tu plan (la ventana de 5 horas y la semana, con su reinicio) y lo que
 * gasta el Workbench cada día. El porcentaje es de toda tu cuenta; el gráfico, solo del Workbench.
 */
@Component({
  selector: 'app-usage-page',
  imports: [
    Alert,
    Button,
    EmptyState,
    Icon,
    PageHeader,
    SegmentedControl,
    Skeleton,
    Spinner,
    TimeAgoPipe,
    UsageByAgent,
    UsageChart,
    UsageMeter,
  ],
  providers: [UsageStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usage-page.html',
  styleUrl: './usage-page.scss',
})
export class UsagePage {
  protected readonly store = inject(UsageStore);
  protected readonly agents = inject(AgentsStore);

  protected readonly unit = signal<ChartUnit>('tokens');
  protected readonly unitOptions = [
    { value: 'tokens', label: 'Tokens' },
    { value: 'points', label: '% estimado de la semana' },
  ];
  protected readonly tokens = formatTokens;
  protected readonly points = formatPoints;

  /** Hay con qué convertir tokens en porcentaje de la semana. */
  protected readonly canEstimate = computed(
    () => this.store.overview()?.calibration.sevenDay.costPerPoint != null,
  );
  /** La última medida es vieja: lo que muestran las barras puede haber cambiado. */
  protected readonly stale = computed(() => {
    const age = this.store.overview()?.current.ageSeconds;
    return age != null && age > USAGE_STALE_SECONDS;
  });
  protected readonly hasData = computed(() => {
    const current = this.store.overview()?.current;
    return !!current && (current.fiveHour !== null || current.sevenDay !== null);
  });

  constructor() {
    void this.agents.load();
    void this.store.load(inject(DestroyRef));
  }

  protected setUnit(value: string): void {
    this.unit.set(value === 'points' && this.canEstimate() ? 'points' : 'tokens');
  }

  protected refresh(): void {
    void this.store.refresh();
  }
}
