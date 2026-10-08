import { copyText } from '@shared/util/copy-text';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { downloadText } from '@shared/util/download-text';
import { Alert } from '@shared/ui/alert/alert';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Toast } from '@shared/ui/toast/toast';
import { PlansStore } from '../../data-access/plans.store';
import { Issue } from '../../models/issue';
import { PLAN_STATUS_LABEL, Plan, PlanStatus, repoShortName } from '../../models/plan';

const TONES: Record<PlanStatus, BadgeTone> = {
  pending: 'neutral',
  generating: 'info',
  ready: 'success',
  failed: 'danger',
};

/**
 * «Plan de ejecución» de una tarea. Solo se muestra cuando ya se pidió un plan: se genera con el
 * botón de IA del encabezado del detalle y aquí se ve el avance, el resultado y el historial.
 */
@Component({
  selector: 'app-plan-panel',
  imports: [TimeAgoPipe, Alert, Badge, Button, Card, Icon, IconButton, MarkdownViewer, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-panel.html',
  styleUrl: './plan-panel.scss',
})
export class PlanPanel {
  readonly issue = input.required<Issue>();

  protected readonly store = inject(PlansStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly toast = inject(Toast);

  protected readonly statusLabel = PLAN_STATUS_LABEL;
  protected readonly repoName = repoShortName;
  protected readonly historyOpen = signal(false);

  protected onHistoryToggle(event: Event): void {
    this.historyOpen.set((event.target as HTMLDetailsElement).open);
  }

  protected readonly history = computed(() => {
    const viewedId = this.store.viewed()?.id;
    return this.store.plans().filter((plan) => plan.id !== viewedId);
  });

  protected tone(status: PlanStatus): BadgeTone {
    return TONES[status];
  }

  protected async copy(): Promise<void> {
    const content = this.store.viewedContent();
    if (!content) return;
    try {
      await copyText(content);
      this.toast.success('Plan copiado');
    } catch {
      this.toast.error('No se pudo copiar; usa «Descargar .md»');
    }
  }

  protected download(): void {
    const content = this.store.viewedContent();
    if (content) downloadText(`plan-${this.slug(this.issue().name)}.md`, content);
  }

  protected view(plan: Plan): void {
    void this.store.view(plan.id);
  }

  protected async remove(plan: Plan): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Eliminar plan',
      message: 'Se borra este plan del historial de la tarea.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed) await this.store.remove(plan.id);
  }

  private slug(name: string): string {
    return (
      name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'tarea'
    );
  }
}
