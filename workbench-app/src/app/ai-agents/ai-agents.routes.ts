import { Routes } from '@angular/router';

/**
 * Los trabajadores (todos los agentes de IA de la app): la lista con filtros, uno nuevo y el detalle de
 * cada uno. Viven en «Automatización → Trabajadores» (`/executions/agents`).
 */
export const AI_AGENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Trabajadores · Workbench',
    loadComponent: () =>
      import('./pages/agent-list-page/agent-list-page').then((m) => m.AgentListPage),
  },
  {
    path: 'new',
    title: 'Nuevo trabajador · Workbench',
    loadComponent: () =>
      import('./pages/agent-form-page/agent-form-page').then((m) => m.AgentFormPage),
  },
  {
    path: ':id/edit',
    title: 'Trabajador · Workbench',
    loadComponent: () =>
      import('./pages/agent-form-page/agent-form-page').then((m) => m.AgentFormPage),
  },
];
