import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '@core/api/api-error';
import { IssuesStore, ProjectsStore } from '@tasks/index';
import { todayIso } from '@shared/util/date';
import { WorkedProject, groupByProject } from '../domain/group-by-project';
import { BucketedHours, bucketHours } from '../domain/buckets';
import {
  DateRange,
  PeriodMode,
  isValidRange,
  monthRange,
  periodRange,
  shiftAnchor,
} from '../domain/period';
import { TimeReport } from '../models/time-report';
import { DashboardApi } from './dashboard.api';

/**
 * Estado del dashboard: el período elegido, el reporte de horas de ese período y lo que resulta de
 * unirlo con las tareas y los proyectos. Se provee en la página (uno por dashboard abierto).
 */
@Injectable()
export class DashboardStore {
  private readonly api = inject(DashboardApi);
  private readonly issues = inject(IssuesStore);
  private readonly projects = inject(ProjectsStore);

  readonly mode = signal<PeriodMode>('week');
  /** Si cuentan las horas de las tareas locales; activo por defecto. */
  readonly includeLocal = signal(true);
  /** Un día cualquiera dentro de la semana o el mes que se está viendo. */
  private readonly anchor = signal(todayIso());
  /** El rango libre arranca en el mes en curso. */
  private readonly customState = signal<DateRange>(monthRange(todayIso()));

  private readonly reportState = signal<TimeReport | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private requestId = 0;

  /** Las fechas del rango libre, aunque todavía no sean válidas. */
  readonly customRange = this.customState.asReadonly();
  readonly report = this.reportState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  /** El rango que se está viendo (en `range`, lo que escribió el usuario, aunque sea inválido). */
  readonly range = computed<DateRange>(() => {
    const mode = this.mode();
    return mode === 'range' ? this.customState() : periodRange(mode, this.anchor());
  });
  readonly rangeValid = computed(() => isValidRange(this.range()));

  readonly totalHours = computed(() => this.reportState()?.totalHours ?? 0);
  readonly activeDays = computed(() => this.reportState()?.byDay.length ?? 0);
  readonly issueCount = computed(() => this.reportState()?.byIssue.length ?? 0);

  /**
   * Las horas del período agrupadas para el gráfico: por día, semana, mes o año según lo largo que
   * sea el período, de modo que el gráfico no crece con el rango.
   */
  readonly chart = computed<BucketedHours | null>(() => {
    const report = this.reportState();
    return report ? bucketHours({ from: report.from, to: report.to }, report.byDay) : null;
  });

  /** Las tareas con horas, agrupadas por proyecto. */
  readonly workedProjects = computed<WorkedProject[]>(() => {
    const report = this.reportState();
    return report
      ? groupByProject(report.byIssue, this.issues.issueById(), this.projects.projectById())
      : [];
  });

  constructor() {
    // Las tareas y los proyectos dan nombre y proyecto a lo que viene del reporte.
    void this.issues.load();
    void this.projects.load();

    // Cada cambio de período o de filtro vuelve a pedir el reporte; un rango inválido no se pide.
    effect(() => {
      const range = this.range();
      const includeLocal = this.includeLocal();
      if (!this.rangeValid()) return;
      untracked(() => void this.load(range, includeLocal));
    });
  }

  setMode(mode: PeriodMode): void {
    this.mode.set(mode);
  }

  /** Semana o mes anterior (`-1`) o siguiente (`1`). No aplica al rango libre. */
  shift(direction: 1 | -1): void {
    const mode = this.mode();
    if (mode === 'range') return;
    this.anchor.update((anchor) => shiftAnchor(mode, anchor, direction));
  }

  /** Vuelve a la semana o al mes en curso. */
  goToToday(): void {
    this.anchor.set(todayIso());
  }

  setCustomRange(range: Partial<DateRange>): void {
    this.customState.update((current) => ({ ...current, ...range }));
  }

  reload(): void {
    if (this.rangeValid()) void this.load(this.range(), this.includeLocal());
  }

  private async load(range: DateRange, includeLocal: boolean): Promise<void> {
    const id = ++this.requestId;
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const report = await firstValueFrom(this.api.timeReport(range.from, range.to, includeLocal));
      // Si mientras tanto se cambió de período, esta respuesta ya no corresponde.
      if (id === this.requestId) this.reportState.set(report);
    } catch (error) {
      if (id === this.requestId) this.errorState.set(errorMessage(error));
    } finally {
      if (id === this.requestId) this.loadingState.set(false);
    }
  }
}
