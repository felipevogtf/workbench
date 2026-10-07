import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Sidebar } from '../sidebar/sidebar';

/** Estructura de la app: sidebar de módulos + contenido. Móvil: barra superior y drawer. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeDrawer()',
    '[class.is-immersive]': 'immersive()',
  },
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly document = inject(DOCUMENT);

  private readonly router = inject(Router);

  protected readonly drawerOpen = signal(false);

  /** Rutas con `data: { immersive: true }` (ej. un tablero) usan todo el ancho, con el menú como panel. */
  protected readonly immersive = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.isImmersive()),
    ),
    { initialValue: this.isImmersive() },
  );

  constructor() {
    // Con el drawer abierto, el fondo no debe hacer scroll.
    effect(() => {
      this.document.body.style.overflow = this.drawerOpen() ? 'hidden' : '';
    });
  }

  private isImmersive(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data['immersive'] === true;
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
