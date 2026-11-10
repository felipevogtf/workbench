import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { NAV_ITEMS, NavItem, isUnder } from '@core/navigation/nav-item';

const STORAGE_KEY = 'workbench.sidebar.open-groups';

/** Menú de módulos. Drawer en móvil (`open`), fijo a partir de 768px. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'open()', '[class.is-drawer]': 'drawer()' },
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly open = input(false);
  /** Siempre como panel flotante (con overlay), también en pantallas anchas. */
  readonly drawer = input(false);
  /** Se emite al elegir un módulo o cerrar el drawer. */
  readonly closed = output<void>();

  private readonly router = inject(Router);
  private readonly registered = inject(NAV_ITEMS, { optional: true }) ?? [];

  protected readonly items = computed(() => [...this.registered].sort((a, b) => a.order - b.order));

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** El grupo abierto, como mucho uno (se recuerda entre visitas). */
  private readonly openGroups = signal<ReadonlySet<string>>(this.restore());

  constructor() {
    // Al navegar dentro de un grupo, se abre solo (ej. al entrar por un enlace directo).
    effect(() => {
      const url = this.url();
      const active = this.items().find((item) => this.hasActiveChild(item, url));
      untracked(() => {
        // Solo un grupo abierto a la vez: el de la ruta actual reemplaza al que estuviera abierto.
        if (active && !this.openGroups().has(active.label)) {
          this.setOpenGroups(new Set([active.label]));
        }
      });
    });
  }

  protected isOpen(item: NavItem): boolean {
    return this.openGroups().has(item.label);
  }

  protected hasActiveChild(item: NavItem, url = this.url()): boolean {
    return !!item.children?.some((child) => isUnder(url, child.path));
  }

  protected toggle(item: NavItem): void {
    // Abrir un grupo cierra el que estuviera abierto.
    this.setOpenGroups(this.isOpen(item) ? new Set() : new Set([item.label]));
  }

  protected groupId(item: NavItem): string {
    return `nav-group-${item.label.toLowerCase().replace(/\W+/g, '-')}`;
  }

  private setOpenGroups(groups: ReadonlySet<string>): void {
    this.openGroups.set(groups);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
    } catch {
      // Sin almacenamiento (modo privado): el estado vive solo en memoria.
    }
  }

  private restore(): ReadonlySet<string> {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      const groups = Array.isArray(stored) ? stored.filter((v) => typeof v === 'string') : [];
      return new Set(groups.slice(0, 1));
    } catch {
      return new Set();
    }
  }
}
