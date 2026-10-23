import type { NavItem } from '@core/navigation/nav-item';

/** Los runners: lo único de las ejecuciones que se visita sin entrar por una tarea. */
export const EXECUTIONS_NAV: NavItem = {
  label: 'Runners',
  icon: 'play',
  path: '/executions/runners',
  order: 15,
};
