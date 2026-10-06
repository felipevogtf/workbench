import { InjectionToken, Provider } from '@angular/core';
import type { IconName } from '@shared/ui/icon/icons';

export interface NavChild {
  label: string;
  icon: IconName;
  /** Ruta absoluta de la página, ej. `/tasks/projects`. */
  path: string;
}

/**
 * Entrada del sidebar: un enlace (`path`) o un grupo desplegable (`children`).
 * Un grupo no navega por sí mismo; solo abre y cierra sus subentradas.
 */
export interface NavItem {
  label: string;
  icon: IconName;
  /** Orden en el sidebar (menor primero). */
  order: number;
  /** Ruta absoluta del módulo, ej. `/pull-requests`. Ausente en los grupos. */
  path?: string;
  children?: readonly NavChild[];
}

/** Cada módulo registra su entrada con `provideNavItem`; el sidebar no conoce a los módulos. */
export const NAV_ITEMS = new InjectionToken<NavItem[]>('NAV_ITEMS');

export function provideNavItem(item: NavItem): Provider {
  return { provide: NAV_ITEMS, useValue: item, multi: true };
}

/** `true` si la URL actual está en `path` o debajo de él (ignora query y fragmento). */
export function isUnder(url: string, path: string): boolean {
  const current = url.split(/[?#]/)[0];
  return current === path || current.startsWith(`${path}/`);
}
