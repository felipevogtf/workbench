import type { NavItem } from '@core/navigation/nav-item';

/**
 * Los proyectos: un repositorio con su receta, sus dependencias y sus reglas. No son los proyectos de
 * tareas (los de Plane), que se ven en el menú de gestión.
 */
export const PROJECTS_NAV: NavItem = {
  label: 'Proyectos',
  icon: 'folder',
  path: '/projects',
  order: 16,
};
