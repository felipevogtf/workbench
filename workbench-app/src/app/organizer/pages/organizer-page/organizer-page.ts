import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AgentsStore } from '@ai-agents/index';
import { IssueExecutionsStore, RunPlanButton } from '@executions/index';
import { IssuesStore } from '@tasks/index';
import { PlanPanel } from '@tasks/components/plan-panel/plan-panel';
import { PlansStore } from '@tasks/data-access/plans.store';
import { TaskChatStore } from '@tasks/data-access/task-chat.store';
import { ChatPanel } from '@shared/chat/chat-panel/chat-panel';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Toast } from '@shared/ui/toast/toast';
import { readableTicket } from '@shared/util/ticket-markdown';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { MembersPanel } from '../../components/members-panel/members-panel';
import { OrganizerStore } from '../../data-access/organizer.store';

const SHARE_KEY = 'workbench.organizer.chat-share';
const MIN_SHARE = 25;
const MAX_SHARE = 75;

function readShare(): number {
  try {
    const saved = Number(localStorage.getItem(SHARE_KEY));
    if (saved >= MIN_SHARE && saved <= MAX_SHARE) return saved;
  } catch {
    // sin almacenamiento
  }
  return 50;
}

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
    RunPlanButton,
    MarkdownViewer,
    MembersPanel,
    Dialog,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly session = this.store.current;
  /** Es la sesión de una sola tarea: sin grupo, sin tareas que sumar ni notas del grupo. */
  protected readonly isTask = computed(() => this.session()?.kind === 'task');
  /** La tarea del grupo tal como la guarda la lista de tareas (la usa el panel del plan). */
  protected readonly groupIssue = computed(() => {
    const session = this.session();
    return session ? (this.issues.issueById().get(session.groupIssueId) ?? null) : null;
  });
  protected readonly assistant = computed(() => this.agents.assistantOf('task-chat'));
  /** La tarea del grupo abierta en una ventana. */
  protected readonly sheet = signal<{ id: string } | null>(null);
  protected readonly sheetTask = computed(() => {
    const open = this.sheet();
    return open ? (this.issues.issueById().get(open.id) ?? null) : null;
  });
  /** La descripción de la tarea abierta, arreglada para leerse (listas y saltos de línea). */
  protected readonly sheetDescription = computed(() => {
    const description = this.sheetTask()?.description;
    return description ? readableTicket(description) : null;
  });
  protected readonly plan = computed(() => this.plans.viewed() ?? this.plans.plans()[0] ?? null);

  /** Cuántos mensajes de la conversación ya entraron en un plan: al replanificar solo viajan los siguientes. */
  private readonly plannedCount = signal(0);

  /** Qué parte de la pantalla ocupa el chat (el resto es el plan), en %; se arrastra el divisor para cambiarlo. */
  protected readonly chatShare = signal(readShare());
  /** La IA entendió que se pidió un cambio al plan mientras había otro en marcha: se aplica en cuanto termine. */
  private readonly pendingReplan = signal(false);

  /** Hay un plan listo: es lo que se puede ejecutar. */
  protected readonly hasReadyPlan = computed(() =>
    this.plans.plans().some((plan) => plan.status === 'ready'),
  );
  protected readonly planning = computed(() => this.plans.requesting() || !!this.plans.active());
  protected readonly canPlan = computed(
    () =>
      (this.isTask() || (this.session()?.members.length ?? 0) > 0) &&
      !this.planning() &&
      !this.chat.sending(),
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
    // Cuando la IA entiende que se pidió un cambio al plan, se aplica solo: no hace falta pulsar nada.
    this.chat.onUpdatesPlan = () => this.pendingReplan.set(true);
    effect(() => {
      if (!this.pendingReplan() || this.planning() || this.chat.sending()) return;
      untracked(() => {
        this.pendingReplan.set(false);
        void this.createPlan();
      });
    });
  }

  /** Arrastrar el divisor entre el chat y el plan. */
  protected dragDivider(event: PointerEvent): void {
    const body = this.host.nativeElement.querySelector('.organizer__body');
    if (!body) return;
    event.preventDefault();
    const box = body.getBoundingClientRect();
    const move = (moved: PointerEvent) =>
      this.setShare(((moved.clientX - box.left) / box.width) * 100, false);
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      this.setShare(this.chatShare(), true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  protected nudgeDivider(event: KeyboardEvent): void {
    const step = event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0;
    if (!step) return;
    event.preventDefault();
    this.setShare(this.chatShare() + step, true);
  }

  private setShare(percent: number, save: boolean): void {
    const share = Math.min(MAX_SHARE, Math.max(MIN_SHARE, Math.round(percent)));
    this.chatShare.set(share);
    if (!save) return;
    try {
      localStorage.setItem(SHARE_KEY, String(share));
    } catch {
      // sin almacenamiento: el ancho vale mientras la página siga abierta
    }
  }

  protected async changeMembers(ids: string[]): Promise<void> {
    await this.store.setMembers(this.id(), ids);
  }

  /**
   * Pide el plan con lo conversado (si algo). La conversación se queda: se sigue viendo y se puede seguir hablando. Al replanificar
   * solo viaja lo que se dijo después del último plan, porque el plan anterior ya lo incorporó.
   */
  protected async createPlan(): Promise<void> {
    const messages = this.chat.snapshot();
    const fresh = messages.slice(this.plannedCount());
    const talked = fresh.some((message) => message.role === 'user');
    const created = await this.plans.generate(talked ? { messages: fresh } : {});
    if (!created) return;
    if (talked) this.markPlanned(messages.length);
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

  private plannedKey(): string {
    return `workbench.organizer.planned.${this.store.current()?.groupIssueId ?? ''}`;
  }

  /** Recuerda hasta qué mensaje llega el último plan (también tras recargar la página). */
  private markPlanned(count: number): void {
    this.plannedCount.set(count);
    try {
      localStorage.setItem(this.plannedKey(), String(count));
    } catch {
      // sin almacenamiento: solo se recuerda mientras la página siga abierta
    }
  }

  private restorePlanned(): void {
    let count = 0;
    try {
      count = Number(localStorage.getItem(this.plannedKey())) || 0;
    } catch {
      // sin almacenamiento
    }
    this.plannedCount.set(Math.min(Math.max(count, 0), this.chat.messages().length));
  }

  private async open(id: string): Promise<void> {
    if (!(await this.store.open(id))) return;
    const groupIssueId = this.store.current()?.groupIssueId;
    if (!groupIssueId) return;
    this.chat.bind(groupIssueId);
    this.restorePlanned();
    void this.plans.load(groupIssueId, this.destroyRef);
    void this.executions.load(groupIssueId, this.destroyRef);
  }
}
