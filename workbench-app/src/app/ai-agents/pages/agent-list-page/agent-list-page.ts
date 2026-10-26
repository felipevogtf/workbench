import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { FormField } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { Select, SelectOption } from '@shared/ui/select/select';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { TextInput } from '@shared/ui/text-input/text-input';
import { WorkerTable } from '../../components/worker-table/worker-table';
import { AgentsStore } from '../../data-access/agents.store';
import {
  Agent,
  EFFORT_OPTIONS,
  LEVEL_OPTIONS,
  LEVEL_ORDER,
  MODULE_OPTIONS,
  MODULE_ORDER,
  agentLabel,
} from '../../models/agent';

/** Minúsculas y sin tildes: «Revisión» coincide con «revision». */
function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Todos los trabajadores (los agentes de IA de la app) en una tabla que se filtra por nombre, módulo,
 * nivel de ticket, modelo y esfuerzo. Lo demás de cada uno (prompt, herramientas, proveedor) está en su
 * detalle.
 */
@Component({
  selector: 'app-agent-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    Button,
    Icon,
    Alert,
    EmptyState,
    FormField,
    Select,
    Skeleton,
    TextInput,
    WorkerTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-list-page.html',
  styleUrl: './agent-list-page.scss',
})
export class AgentListPage {
  protected readonly store = inject(AgentsStore);
  private readonly confirm = inject(ConfirmDialog);

  protected readonly filters = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    module: new FormControl('', { nonNullable: true }),
    level: new FormControl('', { nonNullable: true }),
    model: new FormControl('', { nonNullable: true }),
    effort: new FormControl('', { nonNullable: true }),
  });
  private readonly values = toSignal(
    this.filters.valueChanges.pipe(map(() => this.filters.getRawValue())),
    { initialValue: this.filters.getRawValue() },
  );

  protected readonly moduleOptions: SelectOption[] = [...MODULE_OPTIONS];
  protected readonly levelOptions: SelectOption[] = LEVEL_OPTIONS.filter((option) => option.value);
  protected readonly effortOptions: SelectOption[] = [
    { value: 'auto', label: 'Automático' },
    ...EFFORT_OPTIONS.filter((option) => option.value),
  ];
  /** Los modelos que usan los trabajadores de ahora, para elegir entre ellos. */
  protected readonly modelOptions = computed<SelectOption[]>(() =>
    [...new Set(this.store.agents().map((agent) => agent.model))]
      .sort((a, b) => a.localeCompare(b))
      .map((model) => ({ value: model, label: model })),
  );

  protected readonly hasFilters = computed(() => Object.values(this.values()).some(Boolean));

  /** Los que cumplen los filtros: primero los de la ejecución de tareas, y los desarrolladores de menor a mayor nivel. */
  protected readonly visible = computed(() => {
    const { search, module, level, model, effort } = this.values();
    const text = plain(search.trim());

    return this.store
      .agents()
      .filter(
        (agent) =>
          (!text || plain(`${agentLabel(agent)} ${agent.name}`).includes(text)) &&
          (!module || agent.module === module) &&
          (!level || agent.level === level) &&
          (!model || agent.model === model) &&
          (!effort || (effort === 'auto' ? !agent.effort : agent.effort === effort)),
      )
      .sort(
        (a, b) =>
          MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module) ||
          rank(a) - rank(b) ||
          agentLabel(a).localeCompare(agentLabel(b), 'es'),
      );
  });

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load(true);
  }

  protected clearFilters(): void {
    this.filters.reset();
  }

  protected setDefault(agent: Agent): void {
    void this.store.setDefault(agent.id);
  }

  protected async remove(agent: Agent): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Eliminar trabajador',
      message: `¿Eliminar a «${agentLabel(agent)}»? Las revisiones ya hechas conservan su historial.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (confirmed) {
      await this.store.remove(agent.id);
    }
  }
}

/** Su lugar entre los de un mismo módulo: los desarrolladores por nivel; los demás, al final. */
function rank(agent: Agent): number {
  const index = agent.level ? LEVEL_ORDER.indexOf(agent.level) : -1;
  return index === -1 ? LEVEL_ORDER.length : index;
}
