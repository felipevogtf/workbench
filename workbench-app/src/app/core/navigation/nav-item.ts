import { InjectionToken, Provider } from '@angular/core';
import type { IconName } from '@shared/ui/icon/icons';

export interface NavItem {
  label: string;
  icon: IconName;
  /** Ruta absoluta del módulo, ej. `/pull-requests`. */
  path: string;
  /** Orden en el sidebar (menor primero). */
  order: number;
}

/** Cada módulo registra su entrada con `provideNavItem`; el sidebar no conoce a los módulos. */
export const NAV_ITEMS = new InjectionToken<NavItem[]>('NAV_ITEMS');

export function provideNavItem(item: NavItem): Provider {
  return { provide: NAV_ITEMS, useValue: item, multi: true };
}
