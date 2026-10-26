import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { Alert } from '@shared/ui/alert/alert';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { Icon } from '@shared/ui/icon/icon';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { Spinner } from '@shared/ui/spinner/spinner';
import { FinalReview, FinalReviewFinding, FindingSeverity } from '../../models/execution';

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const SEVERITY_TONE: Record<FindingSeverity, BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

/**
 * La revisión final: un revisor lee toda la rama contra el plan y los tickets y deja un informe. Se pide cuando la
 * ejecución terminó, gasta una llamada grande y no cambia nada por sí sola; cada hallazgo se puede convertir en un
 * ticket de corrección. Esta pieza no guarda nada: avisa al padre.
 */
@Component({
  selector: 'app-final-review-panel',
  imports: [TimeAgoPipe, Alert, Badge, Button, Card, Icon, MarkdownViewer, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-card>
      <h4 card-header>Revisión final</h4>
      <div class="review stack">
        @if (!review()) {
          <p class="muted">
            Un revisor lee toda la rama contra el plan, los tickets y las recetas, y busca lo que la
            revisión de cada ticket no ve: partes del plan sin cubrir, tickets que no encajan entre
            sí o suposiciones que el código contradice. Es opcional y gasta una llamada grande.
          </p>
        } @else if (review()!.status === 'running') {
          <p class="running" role="status">
            <app-spinner size="1em" /> El revisor está leyendo la rama… puede tardar unos minutos.
          </p>
        } @else if (review()!.status === 'failed') {
          <app-alert tone="danger" heading="La revisión final falló">
            {{ review()!.error }}
          </app-alert>
        } @else {
          @if (review()!.summary) {
            <p class="summary">{{ review()!.summary }}</p>
          }
          @if (review()!.findings.length === 0) {
            <p class="muted">No encontró problemas.</p>
          } @else {
            <ol class="findings" aria-label="Hallazgos">
              @for (finding of review()!.findings; track $index) {
                <li class="finding">
                  <div class="finding__head">
                    <app-badge [tone]="tone(finding)">{{ label(finding) }}</app-badge>
                    @if (finding.file) {
                      <code class="finding__file">{{ finding.file }}</code>
                    }
                  </div>
                  <p class="finding__issue">{{ finding.issue }}</p>
                  @if (finding.suggestion) {
                    <div class="finding__suggestion">
                      <strong>Qué cambiar:</strong>
                      <app-markdown-viewer [content]="finding.suggestion" />
                    </div>
                  }
                  @if (completed()) {
                    <button
                      app-button
                      variant="secondary"
                      size="sm"
                      type="button"
                      [disabled]="busy()"
                      (click)="fix.emit(finding)"
                    >
                      <app-icon name="plus" size="1em" /> Corregir con un ticket
                    </button>
                  }
                </li>
              }
            </ol>
          }
          @if (review()!.finishedAt) {
            <p class="muted">Hecha {{ review()!.finishedAt! | timeAgo }}.</p>
          }
        }

        @if (completed() && review()?.status !== 'running') {
          <div>
            <button
              app-button
              [variant]="review() ? 'secondary' : 'primary'"
              type="button"
              [disabled]="busy()"
              (click)="requested.emit()"
            >
              {{ review() ? 'Pedirla de nuevo' : 'Pedir la revisión final' }}
            </button>
          </div>
        }
      </div>
    </app-card>
  `,
  styles: `
    h4[card-header] {
      font-weight: 600;
      color: var(--primary);
    }

    .muted {
      margin: 0;
      font-size: 0.875rem;
      color: var(--text-color);
    }

    .running {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
    }

    .summary {
      margin: 0;
      font-weight: 500;
    }

    .findings {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .finding {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--border-radius);
    }

    .finding__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .finding__file {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      overflow-wrap: anywhere;
    }

    .finding__issue {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .finding__suggestion {
      font-size: 0.875rem;
      overflow-wrap: anywhere;
    }

    .finding button {
      justify-self: start;
    }
  `,
})
export class FinalReviewPanel {
  /** El informe; `null` si nunca se pidió. */
  readonly review = input<FinalReview | null>(null);
  /** La ejecución terminó: se puede pedir la revisión y corregir con tickets. */
  readonly completed = input(false);
  readonly busy = input(false);

  readonly requested = output();
  /** El usuario quiere corregir este hallazgo con un ticket. */
  readonly fix = output<FinalReviewFinding>();

  protected label(finding: FinalReviewFinding): string {
    return SEVERITY_LABEL[finding.severity];
  }

  protected tone(finding: FinalReviewFinding): BadgeTone {
    return SEVERITY_TONE[finding.severity];
  }
}
