import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AgentsStore } from '@ai-agents/index';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { downloadText } from '@shared/util/download-text';
import { Alert } from '@shared/ui/alert/alert';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Toast } from '@shared/ui/toast/toast';
import { LabelsStore } from '../../data-access/labels.store';
import { PlansStore } from '../../data-access/plans.store';
import { Issue } from '../../models/issue';
import { PLAN_STATUS_LABEL, Plan, PlanStatus, repoShortName } from '../../models/plan';

const TONES: Record<PlanStatus, BadgeTone> = {
  pending: 'neutral',
  generating: 'info',
  ready: 'success',
  failed: 'danger',
};

/** «Plan de ejecución» de una tarea: lo genera un agente del planificador y se ve solo aquí. */
@Component({
  selector: 'app-plan-panel',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TimeAgoPipe,
    Alert,
    Badge,
    Button,
    Card,
    FormField,
    Icon,
    IconButton,
    MarkdownViewer,
    Select,
    Spinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-panel.html',
  styleUrl: './plan-panel.scss',
})
export class PlanPanel {
  readonly issue = input.required<Issue>();

  protected readonly store = inject(PlansStore);
  private readonly agents = inject(AgentsStore);
  private readonly labels = inject(LabelsStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly toast = inject(Toast);

  protected readonly agentControl = new FormControl('', { nonNullable: true });
  protected readonly statusLabel = PLAN_STATUS_LABEL;
  protected readonly repoName = repoShortName;
  protected readonly historyOpen = signal(false);

  constructor() {
    void this.agents.load();
    void this.labels.load();
  }

  /** Repositorios de las etiquetas de la tarea: los que leerá el planificador. */
  protected readonly repos = computed(() => {
    const byId = this.labels.labelById();
    const urls = this.issue()
      .labelIds.flatMap((id) => byId.get(id)?.repoUrl ?? [])
      .filter((url, index, all) => all.indexOf(url) === index);
    return urls;
  });

  protected readonly agentOptions = computed<SelectOption[]>(() =>
    this.agents.agentsOf('planner').map((agent) => ({
      value: agent.id,
      label: agent.isDefault ? `${agent.name} (por defecto)` : agent.name,
    })),
  );
  protected readonly defaultLabel = computed(() => {
    const agent = this.agents.defaultAgentOf('planner');
    return agent ? `Por defecto: ${agent.name}` : 'Agente por defecto';
  });

  protected readonly history = computed(() => {
    const viewedId = this.store.viewed()?.id;
    return this.store.plans().filter((plan) => plan.id !== viewedId);
  });

  protected tone(status: PlanStatus): BadgeTone {
    return TONES[status];
  }

  protected generate(): void {
    const agentId = this.agentControl.value;
    void this.store.generate(agentId ? { agentId } : {});
  }

  protected async copy(): Promise<void> {
    const content = this.store.viewedContent();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
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
