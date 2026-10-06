import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Badge, BadgeTone } from '@shared/ui/badge/badge';
import { priorityLabel } from '../../models/issue';

const TONES: Record<string, BadgeTone> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

/** Prioridad de una tarea. Sin prioridad (o `none`) no muestra nada: no aporta a la lectura. */
@Component({
  selector: 'app-priority-badge',
  imports: [Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <app-badge [tone]="tone()" dot>{{ label() }}</app-badge>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class PriorityBadge {
  readonly priority = input<string | null>(null);

  protected readonly visible = computed(() => !!this.priority() && this.priority() !== 'none');
  protected readonly tone = computed<BadgeTone>(() => TONES[this.priority() ?? ''] ?? 'neutral');
  protected readonly label = computed(() => priorityLabel(this.priority()));
}
