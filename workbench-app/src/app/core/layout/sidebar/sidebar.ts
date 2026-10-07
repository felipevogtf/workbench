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

  /** Grupos abiertos por el usuario (se recuerdan entre visitas). */
  private readonly openGroups = signal<ReadonlySet<string>>(this.restore());

  constructor() {
    // Al navegar dentro de un grupo, se abre solo (ej. al entrar por un enlace directo).
    effect(() => {
      const url = this.url();
      const active = this.items().filter((item) => this.hasActiveChild(item, url));
      untracked(() => {
        const missing = active.filter((item) => !this.openGroups().has(item.label));
        if (missing.length > 0) {
          this.setOpenGroups(new Set([...this.openGroups(), ...missing.map((item) => item.label)]));
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
    const next = new Set(this.openGroups());
    if (!next.delete(item.label)) next.add(item.label);
    this.setOpenGroups(next);
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
      return new Set(Array.isArray(stored) ? stored.filter((v) => typeof v === 'string') : []);
    } catch {
      return new Set();
    }
  }
}
