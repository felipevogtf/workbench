import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icons';

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Raya separadora antes de la opción. */
  separated?: boolean;
}

/**
 * Menú desplegable de acciones (botón de tres puntos). Teclado, `Esc`, foco de vuelta al botón y
 * posicionamiento los resuelve `@angular/cdk/menu`. Emite el `id` de la opción elegida.
 */
@Component({
  selector: 'app-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="menu__trigger"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      [cdkMenuTriggerFor]="panel"
      [disabled]="disabled()"
    >
      <app-icon [name]="icon()" />
    </button>

    <ng-template #panel>
      <div class="menu__panel" cdkMenu [attr.aria-label]="label()">
        @for (item of items(); track item.id) {
          @if (item.separated) {
            <hr />
          }
          <button
            type="button"
            class="menu__item"
            cdkMenuItem
            [attr.data-tone]="item.tone"
            [cdkMenuItemDisabled]="!!item.disabled"
            (cdkMenuItemTriggered)="selected.emit(item.id)"
          >
            @if (item.icon) {
              <app-icon [name]="item.icon" size="1.1rem" />
            }
            <span>{{ item.label }}</span>
          </button>
        }
      </div>
    </ng-template>
  `,
  styleUrl: './menu.scss',
})
export class Menu {
  /** Nombre accesible del botón (obligatorio: es solo un ícono). */
  readonly label = input.required<string>();
  readonly items = input.required<readonly MenuItem[]>();
  readonly icon = input<IconName>('more');
  readonly disabled = input(false);

  readonly selected = output<string>();
}
