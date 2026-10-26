import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Badge } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Toast } from '@shared/ui/toast/toast';
import { IssueExecutionsStore } from '../../data-access/issue-executions.store';
import { RunnerLauncher } from '../../data-access/runner-launcher';
import {
  EXECUTION_STATUS_LABEL,
  EXECUTION_STATUS_TONE,
  executionProgress,
} from '../../models/execution';

/** Cuántas ejecuciones se listan en el panel; el resto se ve entrando a cada una. */
const HISTORY_SHOWN = 5;

/**
 * «Ejecutar con IA» en el detalle de una tarea: lanza la ejecución con el último plan y lista las
 * anteriores. El estado vive en `IssueExecutionsStore`, que provee la página que lo usa.
 */
@Component({
  selector: 'app-execution-panel',
  imports: [RouterLink, TimeAgoPipe, Badge, Button, Card, Icon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './execution-panel.html',
  styleUrl: './execution-panel.scss',
})
export class ExecutionPanel {
  /** La tarea a ejecutar. */
  readonly issueId = input.required<string>();
  /** La tarea ya tiene un plan listo, que es lo que se ejecuta. */
  readonly canRun = input(false);

  protected readonly store = inject(IssueExecutionsStore);
  private readonly router = inject(Router);
  private readonly launcher = inject(RunnerLauncher);
  private readonly toast = inject(Toast);

  /** Se está despertando al runner antes de ejecutar. */
  protected readonly launching = signal(false);

  protected readonly statusLabel = EXECUTION_STATUS_LABEL;
  protected readonly statusTone = EXECUTION_STATUS_TONE;
  protected readonly history = computed(() => this.store.executions().slice(0, HISTORY_SHOWN));
  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.store.executions().length - HISTORY_SHOWN),
  );

  /** Progreso en una frase, p. ej. «Ticket 2 de 3: En revisión». */
  protected readonly progress = executionProgress;

  protected async run(): Promise<void> {
    // Antes de ejecutar, que haya un runner: si no está corriendo, se le pide a Windows que lo abra.
    this.launching.set(true);
    let readiness;
    try {
      readiness = await this.launcher.ensureOnline();
    } finally {
      this.launching.set(false);
    }

    if (readiness === 'no-runners') {
      this.toast.error('Todavía no hay ningún runner: créalo en «Runners» para poder ejecutar.');
      return;
    }
    if (readiness === 'timeout') {
      this.toast.info(
        'El runner no se abrió solo. Ábrelo en tu PC (npm start) y la ejecución seguirá sola.',
      );
    }

    const execution = await this.store.start();
    if (execution) await this.router.navigate(['/executions', execution.id]);
  }
}
