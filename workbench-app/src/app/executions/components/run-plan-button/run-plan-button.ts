import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Toast } from '@shared/ui/toast/toast';
import { IssueExecutionsStore } from '../../data-access/issue-executions.store';
import { RunnerLauncher } from '../../data-access/runner-launcher';

/**
 * «Ejecutar plan»: un botón de solo icono (para una barra superior) que lanza la ejecución con el último plan, despertando antes al runner
 * si hace falta. Mientras hay una ejecución en marcha, lleva a ella. El estado vive en `IssueExecutionsStore`, que provee la página.
 */
@Component({
  selector: 'app-run-plan-button',
  imports: [RouterLink, Icon, IconButton, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.active(); as active) {
      <a
        app-icon-button
        label="Ver la ejecución en curso"
        [routerLink]="['/executions', active.id]"
      >
        <app-spinner size="1.1rem" />
      </a>
    } @else {
      <button
        app-icon-button
        type="button"
        [label]="
          launching()
            ? 'Iniciando el runner…'
            : canRun()
              ? 'Ejecutar el plan'
              : 'Primero genera un plan'
        "
        [disabled]="!canRun() || launching() || store.starting()"
        (click)="run()"
      >
        @if (launching() || store.starting()) {
          <app-spinner size="1.1rem" />
        } @else {
          <app-icon name="play" size="1.1rem" />
        }
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
