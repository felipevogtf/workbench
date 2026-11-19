import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AgentsStore } from '@ai-agents/index';
import { IssueExecutionsStore, RunPlanButton } from '@executions/index';
import { ProjectsApi, type Project } from '@projects/index';
import { IssuesStore } from '@tasks/index';
import { PlanPanel } from '@tasks/components/plan-panel/plan-panel';
import { PlansStore } from '@tasks/data-access/plans.store';
import { TaskChatStore } from '@tasks/data-access/task-chat.store';
import { Topbar } from '../../../core/layout/topbar/topbar';
import { ChatPanel } from '@shared/chat/chat-panel/chat-panel';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ChipOption, ChipPicker } from '@shared/ui/chip-picker/chip-picker';
import { Dialog } from '@shared/ui/dialog/dialog';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Toast } from '@shared/ui/toast/toast';
import { readableTicket } from '@shared/util/ticket-markdown';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { MembersPanel } from '../../components/members-panel/members-panel';
import { OrganizerStore } from '../../data-access/organizer.store';
import { MAX_SESSION_PROJECTS } from '../../models/organizer';
import { NEW_SESSION_TITLE, titleFromMessage } from '../../models/session-title';

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
 * Una conversación del organizador (`/organizer/:id`): un chat a pantalla completa con la IA, al que se le suman proyectos
 * (repositorios) y tickets cuando hacen falta, ninguno obligatorio, y de ahí el plan y la ejecución. El grupo es una tarea más (`groupIssueId`): el chat, el plan y
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
    ChipPicker,
    Icon,
    IconButton,
    Skeleton,
    Spinner,
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
  private readonly projectsApi = inject(ProjectsApi);
  private readonly confirm = inject(ConfirmDialog);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly topbar = inject(Topbar);
  /** Los botones de la sesión, que viven en la barra superior de la app. */
  private readonly topbarActions = viewChild<TemplateRef<unknown>>('topbarActions');

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

  /** Lo que se muestra a la derecha del chat: el plan o los tickets de la sesión; `null` = solo el chat, a todo el ancho. */
  protected readonly side = signal<'plan' | 'members' | 'projects' | null>(null);

  /** Los proyectos que se pueden sumar a la conversación, y cuántos admite. */
  private readonly repoProjects = signal<Project[]>([]);
  protected readonly maxProjects = MAX_SESSION_PROJECTS;
  protected readonly projectOptions = computed<ChipOption[]>(() => {
    const known = this.repoProjects().map((project) => ({
      value: project.repo,
      label: project.name,
    }));
    // Un proyecto de la conversación que ya no existe se sigue mostrando, para poder quitarlo.
    const missing = (this.session()?.projectRepos ?? [])
      .filter((repo) => !known.some((option) => option.value === repo))
      .map((repo) => ({ value: repo, label: repo }));
    return [...known, ...missing];
  });
  /** Los nombres de los proyectos de la conversación, para mostrarlos en la barra. */
  protected readonly projectNames = computed(() => {
    const byRepo = new Map(this.repoProjects().map((project) => [project.repo, project.name]));
    return (this.session()?.projectRepos ?? []).map((repo) => byRepo.get(repo) ?? repo);
  });
  /** Cuántas versiones listas del plan hay (la ficha dice en cuál va). */
  protected readonly planVersion = computed(
    () => this.plans.plans().filter((plan) => plan.status === 'ready').length,
  );

  /** Cuántos mensajes de la conversación ya entraron en un plan: al replanificar solo viajan los siguientes. */
  private readonly plannedCount = signal(0);

  /** Qué parte de la pantalla ocupa el chat (el resto es el plan), en %; se arrastra el divisor para cambiarlo. */
  protected readonly chatShare = signal(readShare());
  /** La IA entendió que se pidió un cambio al plan mientras había otro en marcha: se aplica en cuanto termine. */
  private readonly pendingReplan = signal<'update' | 'rebuild' | null>(null);

  /** Hay un plan listo: es lo que se puede ejecutar. */
  protected readonly hasReadyPlan = computed(() =>
    this.plans.plans().some((plan) => plan.status === 'ready'),
  );
  protected readonly planning = computed(() => this.plans.requesting() || !!this.plans.active());
  protected readonly canPlan = computed(
    () =>
      // Con tickets, o con algo hablado: una conversación sin tickets también se puede planificar.
      (this.isTask() ||
        (this.session()?.members.length ?? 0) > 0 ||
        this.chat.messages().some((message) => message.role === 'user')) &&
      !this.planning() &&
      !this.chat.sending(),
  );

  /** Sin tickets no hay nada que ordenar: las sugerencias son para empezar. */
  protected readonly hasTickets = computed(() => (this.session()?.members.length ?? 0) > 0);
  protected readonly suggestions = computed(() =>
    this.isTask() || this.hasTickets()
      ? [
          '¿Qué depende de qué entre estas tareas? ¿En qué orden conviene hacerlas?',
          '¿Dónde chocan estas tareas (mismos archivos o textos)?',
          '¿Qué riesgos o dudas ves antes de planificarlas?',
        ]
      : [
          'Explícame cómo funciona esta parte del proyecto.',
          'Quiero agregar una funcionalidad. ¿Por dónde empezamos?',
          'Ayúdame a entender por qué falla esto.',
        ],
  );

  constructor() {
    void this.agents.load();
    void this.issues.load();
    void this.loadProjects();
    effect(() => {
      const id = this.id();
      untracked(() => void this.open(id));
    });
    // El título y los botones de la sesión van en la barra superior de la app.
    effect(() => {
      const subtitle = this.session()?.title ?? null;
      const actions = this.topbarActions() ?? null;
      untracked(() => this.topbar.set({ subtitle, actions }));
    });
    this.destroyRef.onDestroy(() => {
      this.topbar.clear();
      this.discardIfUnused();
    });
    // El primer mensaje le pone nombre a la conversación (hasta entonces es «Nueva conversación»).
    effect(() => {
      const session = this.session();
      const first = this.chat.messages().find((message) => message.role === 'user');
      if (!session || session.kind !== 'group' || session.title !== NEW_SESSION_TITLE || !first) {
        return;
      }
      const title = titleFromMessage(first.content);
      if (title) untracked(() => void this.store.update(session.id, { title }));
    });
    // Cuando la IA entiende que se pidió un cambio al plan, se aplica solo: no hace falta pulsar nada.
    this.chat.onUpdatesPlan = (rebuild) =>
      this.pendingReplan.update((current) =>
        rebuild || current === 'rebuild' ? 'rebuild' : 'update',
      );
    effect(() => {
      const pending = this.pendingReplan();
      if (!pending || this.planning() || this.chat.sending()) return;
      untracked(() => {
        this.pendingReplan.set(null);
        void this.createPlan(pending === 'rebuild');
      });
    });
  }

  /** Abre (o cierra, si ya estaba abierto) el plan o los tickets a la derecha del chat. */
  protected toggleSide(which: 'plan' | 'members' | 'projects'): void {
    this.side.update((current) => (current === which ? null : which));
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

  /** Suma o quita proyectos de la conversación: no hace falta tener ninguno. */
  protected async changeProjects(repos: string[]): Promise<void> {
    if (repos.length > MAX_SESSION_PROJECTS) {
      this.toast.error(`Una conversación admite hasta ${MAX_SESSION_PROJECTS} proyectos`);
      return;
    }
    await this.store.setProjects(this.id(), repos);
  }

  protected async changeMembers(ids: string[]): Promise<void> {
    await this.store.setMembers(this.id(), ids);
  }

  protected async createTicket(name: string): Promise<void> {
    await this.store.addTicket(this.id(), name);
  }

  /**
   * Pide el plan con lo conversado (si algo). La conversación se queda: se sigue viendo y se puede seguir hablando. Al replanificar
   * solo viaja lo que se dijo después del último plan, porque el plan anterior ya lo incorporó. Con `rebuild` se hace de cero, sin
   * partir del plan anterior (que queda en el historial), con toda la conversación.
   */
  protected async createPlan(rebuild = false): Promise<void> {
    const messages = this.chat.snapshot();
    const sent = rebuild ? messages : messages.slice(this.plannedCount());
    const talked = sent.some((message) => message.role === 'user');
    const request = talked
      ? rebuild
        ? { messages: sent, fromScratch: true }
        : { messages: sent }
      : {};
    const created = await this.plans.generate(request);
    if (!created) return;
    if (talked) this.markPlanned(messages.length);
  }

  /** Hay un plan que borrar para empezar de cero. */
  protected readonly canReset = computed(() => !this.planning() && this.plans.plans().length > 0);

  /**
   * Borra el plan (y su historial) para planificar otra vez desde cero. La conversación se queda: el próximo plan se hace con toda
   * ella, no solo con lo dicho después del último.
   */
  protected async reset(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Borrar el plan',
      message: this.isTask()
        ? 'Se borran el plan de la tarea y su historial. La conversación se conserva. Esto no se puede deshacer.'
        : 'Se borran el plan del grupo y su historial. La conversación se conserva. Esto no se puede deshacer.',
      confirmLabel: 'Borrar el plan',
      tone: 'danger',
    });
    if (!confirmed || !(await this.plans.removeAll())) return;
    this.markPlanned(0);
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

  private async loadProjects(): Promise<void> {
    try {
      this.repoProjects.set(await firstValueFrom(this.projectsApi.list()));
    } catch {
      // Sin la lista se siguen viendo los proyectos de la conversación, con su repositorio como nombre.
    }
  }

  /** Una conversación que nunca se usó (sin mensajes, proyectos ni tickets) no deja rastro en la lista. */
  private discardIfUnused(): void {
    const session = this.store.current();
    if (
      !session ||
      session.kind !== 'group' ||
      session.title !== NEW_SESSION_TITLE ||
      session.members.length > 0 ||
      session.projectRepos.length > 0 ||
      this.chat.messages().length > 0
    ) {
      return;
    }
    void this.store.discard(session.id);
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
