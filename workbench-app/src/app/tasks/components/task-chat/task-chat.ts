import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { AgentsStore } from '@ai-agents/index';
import { TimeAgoPipe } from '@shared/pipes/time-ago';
import { ChatPanel } from '@shared/chat/chat-panel/chat-panel';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import { Toast } from '@shared/ui/toast/toast';
import { PlansStore } from '../../data-access/plans.store';
import { TaskChatStore } from '../../data-access/task-chat.store';
import { Issue } from '../../models/issue';

/**
 * Chat flotante para mejorar el plan de una tarea: aclarar las dudas que dejó, pasarle otros tickets o
 * corregirlo. La IA conoce la tarea, sus tickets de Plane, el último plan y el código de sus repos. Al
 * final, «Replanificar» genera un plan nuevo a partir del anterior y de lo conversado, y la
 * conversación se limpia (el plan nuevo ya la incorporó).
 */
@Component({
  selector: 'app-task-chat',
  imports: [ChatPanel, Button, Icon, TimeAgoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './task-chat.html',
  styleUrl: './task-chat.scss',
})
export class TaskChat {
  readonly issue = input.required<Issue>();

  protected readonly chat = inject(TaskChatStore);
  private readonly agents = inject(AgentsStore);

  /** Quien contesta: el agente del chat de tareas, con el nombre y la imagen con que se ve en la app. */
  protected readonly assistant = computed(() => this.agents.assistantOf('task-chat'));

  /** Preguntas para empezar. */
  protected readonly suggestions = [
    '¿Qué dudas o supuestos deja el plan?',
    '¿Falta algún paso o algún riesgo en el plan?',
    '¿El plan cubre todo lo que pide la descripción?',
  ];
  protected readonly plans = inject(PlansStore);
  private readonly toast = inject(Toast);

  /** El plan que la IA tiene a la vista: el último que está listo. */
  protected readonly readyPlan = computed(
    () => this.plans.plans().find((plan) => plan.status === 'ready') ?? null,
  );

  /** Replanificar necesita algo que el usuario haya dicho y que no haya otro plan en marcha. */
  protected readonly canReplan = computed(
    () =>
      this.chat.messages().some((message) => message.role === 'user') &&
      !this.chat.sending() &&
      !this.plans.requesting() &&
      !this.plans.active(),
  );

  constructor() {
    void this.agents.load();
    effect(() => this.chat.bind(this.issue().id));
  }

  protected async replan(): Promise<void> {
    const created = await this.plans.generate({ messages: this.chat.snapshot() });
    if (!created) return;

    // El plan nuevo ya incorpora lo conversado: se parte de una conversación limpia.
    this.chat.clear();
    this.chat.close();
    this.toast.success('Replanificando con la conversación');
    // El panel de planes aparece al final en cuanto hay un plan; se espera a que se pinte para llegar a él.
    setTimeout(
      () => document.getElementById('plan-panel')?.scrollIntoView({ behavior: 'smooth' }),
      50,
    );
  }
}
