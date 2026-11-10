import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import { Toast } from '@shared/ui/toast/toast';
import { IssueExecutionsStore } from '../../data-access/issue-executions.store';
import { RunnerLauncher } from '../../data-access/runner-launcher';

/**
 * «Ejecutar plan»: un solo botón (para una barra superior) que lanza la ejecución con el último plan, despertando antes al runner
 * si hace falta. Mientras hay una ejecución en marcha, lleva a ella. El estado vive en `IssueExecutionsStore`, que provee la página.
 */
@Component({
  selector: 'app-run-plan-button',
  imports: [RouterLink, Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.active(); as active) {
      <a app-button size="sm" variant="secondary" [routerLink]="['/executions', active.id]">
        <app-icon name="play" size="1em" /> Ver ejecución
      </a>
    } @else {
      <button
        app-button
        size="sm"
        type="button"
        [loading]="store.starting() || launching()"
        [disabled]="!canRun() || launching()"
        [title]="canRun() ? '' : 'Primero genera un plan de ejecución'"
        (click)="run()"
      >
        <app-icon name="play" size="1em" />
        {{ launching() ? 'Iniciando el runner…' : 'Ejecutar plan' }}
      </button>
    }
  `,
})
export class RunPlanButton {
  /** Ya hay un plan listo, que es lo que se ejecuta. */
  readonly canRun = input(false);
  /** Quitarla deja una ejecución de prueba: sube la rama pero no abre la PR. */
  readonly openPr = input(true);

  protected readonly store = inject(IssueExecutionsStore);
  private readonly router = inject(Router);
  private readonly launcher = inject(RunnerLauncher);
  private readonly toast = inject(Toast);

  /** Se está despertando al runner antes de ejecutar. */
  protected readonly launching = signal(false);

  protected async run(): Promise<void> {
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

    const execution = await this.store.start(this.openPr() ? {} : { openPullRequest: false });
    if (execution) await this.router.navigate(['/executions', execution.id]);
  }
}
