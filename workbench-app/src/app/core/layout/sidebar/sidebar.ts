import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { NAV_ITEMS } from '@core/navigation/nav-item';

/** Menú de módulos. Drawer en móvil (`open`), fijo a partir de 768px. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open()' },
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly open = input(false);
  /** Se emite al elegir un módulo o cerrar el drawer. */
  readonly closed = output<void>();

  private readonly registered = inject(NAV_ITEMS, { optional: true }) ?? [];

  protected readonly items = computed(() => [...this.registered].sort((a, b) => a.order - b.order));
}
