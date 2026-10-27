import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AgentsStore } from '@ai-agents/index';
import { ExecutionPanel, IssueExecutionsStore } from '@executions/index';
import { IssuesStore } from '@tasks/index';
import { PLAN_STATUS_LABEL } from '@tasks/models/plan';
import { PlanPanel } from '@tasks/components/plan-panel/plan-panel';
import { PlansStore } from '@tasks/data-access/plans.store';
import { TaskChatStore } from '@tasks/data-access/task-chat.store';
import { ChatPanel } from '@shared/chat/chat-panel/chat-panel';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Toast } from '@shared/ui/toast/toast';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { MembersPanel } from '../../components/members-panel/members-panel';
import { SideSheet } from '../../components/side-sheet/side-sheet';
import { OrganizerStore } from '../../data-access/organizer.store';

/**
 * Una sesión del organizador (`/organizer/:id`): las tareas que se hacen juntas, un chat a pantalla completa con la IA para
 * planificarlas, el plan de todas y, cuando está bien, la ejecución. El grupo es una tarea más (`groupIssueId`): el chat, el plan y
 * la ejecución son los de siempre, pedidos con su id.
 */
@Component({
  selector: 'app-organizer-page',
  imports: [
    RouterLink,
    ChatPanel,
    PlanPanel,
    ExecutionPanel,
    MarkdownViewer,
    MembersPanel,
    SideSheet,
    Alert,
    Button,
    Icon,
    IconButton,
    Skeleton,
  ],
  providers: [PlansStore, TaskChatStore, IssueExecutionsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './organizer-page.html',
  styleUrl: './organizer-page.scss',
})
export class OrganizerPage {
  /** Viene de la ruta (`withComponentInputBinding`). */
  readonly id = input.required<string>();

  protected readonly store = inject(OrganizerStore);
  protected readonly chat = inject(TaskChatStore);
  protected readonly plans = inject(PlansStore);
  protected readonly executions = inject(IssueExecutionsStore);
  private readonly issues = inject(IssuesStore);
  private readonly agents = inject(AgentsStore);
  private readonly confirm = inject(ConfirmDialog);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly session = this.store.current;
  /** La tarea del grupo tal como la guarda la lista de tareas (la usa el panel del plan). */
  protected readonly groupIssue = computed(() => {
    const session = this.session();
    return session ? (this.issues.issueById().get(session.groupIssueId) ?? null) : null;
  });
  protected readonly assistant = computed(() => this.agents.assistantOf('task-chat'));
  protected readonly statusLabel = PLAN_STATUS_LABEL;
  /** Lo que está abierto en el panel lateral: una tarea del grupo o el plan. */
  protected readonly sheet = signal<{ kind: 'task'; id: string } | { kind: 'plan' } | null>(null);
  protected readonly sheetTask = computed(() => {
    const open = this.sheet();
    return open?.kind === 'task' ? (this.issues.issueById().get(open.id) ?? null) : null;
  });
  protected readonly plan = computed(() => this.plans.viewed() ?? this.plans.plans()[0] ?? null);
  protected readonly notes = signal('');
  protected readonly notesChanged = computed(
    () => this.notes().trim() !== (this.session()?.notes ?? '').trim(),
  );

  /** Hay un plan listo: es lo que se puede ejecutar. */
  protected readonly hasReadyPlan = computed(() =>
    this.plans.plans().some((plan) => plan.status === 'ready'),
  );
  protected readonly planning = computed(() => this.plans.requesting() || !!this.plans.active());
  protected readonly canPlan = computed(
    () => (this.session()?.members.length ?? 0) > 0 && !this.planning() && !this.chat.sending(),
  );

  protected readonly suggestions = [
    '¿Qué depende de qué entre estas tareas? ¿En qué orden conviene hacerlas?',
    '¿Dónde chocan estas tareas (mismos archivos o textos)?',
    '¿Qué riesgos o dudas ves antes de planificarlas?',
  ];

  constructor() {
    void this.agents.load();
    void this.issues.load();
    effect(() => {
      const id = this.id();
      untracked(() => void this.open(id));
    });
    // Las notas del grupo reflejan las de la sesión (también tras guardarlas).
    effect(() => {
      const notes = this.session()?.notes ?? '';
      untracked(() => this.notes.set(notes));
    });
  }

  protected async changeMembers(ids: string[]): Promise<void> {
    await this.store.setMembers(this.id(), ids);
  }

  protected async saveNotes(): Promise<void> {
    if (await this.store.update(this.id(), { notes: this.notes().trim() })) {
      this.toast.success('Notas guardadas');
    }
  }

  /** Pide el plan del grupo con lo conversado (si algo) y deja la conversación limpia: el plan ya la incorporó. */
  protected async createPlan(): Promise<void> {
    const messages = this.chat.snapshot();
    const talked = messages.some((message) => message.role === 'user');
    const created = await this.plans.generate(talked ? { messages } : {});
    if (!created) return;
    if (talked) this.chat.clear();
    this.toast.success(talked ? 'Replanificando con la conversación' : 'Generando el plan');
    // El panel del plan aparece al final en cuanto hay uno; se espera a que se pinte para llegar a él.
    setTimeout(
      () => document.getElementById('plan-panel')?.scrollIntoView({ behavior: 'smooth' }),
      50,
    );
  }

  protected async remove(): Promise<void> {
    const session = this.session();
    if (!session) return;
    const confirmed = await this.confirm.ask({
      title: 'Eliminar sesión',
      message: `¿Eliminar «${session.title}»? Sus tareas quedan libres; se pierde el plan de este grupo.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed && (await this.store.remove(session.id))) {
      await this.router.navigateByUrl('/organizer');
    }
  }

  private async open(id: string): Promise<void> {
    if (!(await this.store.open(id))) return;
    const groupIssueId = this.store.current()?.groupIssueId;
    if (!groupIssueId) return;
    this.chat.bind(groupIssueId);
    void this.plans.load(groupIssueId, this.destroyRef);
    void this.executions.load(groupIssueId, this.destroyRef);
  }
}
