import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { Sidebar } from '../sidebar/sidebar';

/** Estructura de la app: sidebar de módulos + contenido. Móvil: barra superior y drawer. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeDrawer()' },
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly document = inject(DOCUMENT);

  protected readonly drawerOpen = signal(false);

  constructor() {
    // Con el drawer abierto, el fondo no debe hacer scroll.
    effect(() => {
      this.document.body.style.overflow = this.drawerOpen() ? 'hidden' : '';
    });
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
