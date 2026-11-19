import type { NavItem } from '@core/navigation/nav-item';

/** Grupo desplegable del sidebar: la lista de tareas y los catálogos que la acompañan. */
export const TASKS_NAV: NavItem = {
  label: 'Gestión',
  icon: 'list-checks',
  order: 5,
  children: [
    { label: 'Tareas', icon: 'list-checks', path: '/tasks/issues' },
    { label: 'Proyectos', icon: 'folder', path: '/tasks/projects' },
    { label: 'Estados', icon: 'circle-dot', path: '/tasks/states' },
    { label: 'Etiquetas', icon: 'tag', path: '/tasks/labels' },
  ],
};
