import { Routes } from '@angular/router';

/** Las mismas páginas, pero solo con los agentes de los trabajadores (`/executions/agents`). */
export const WORKER_AGENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Agentes · Trabajadores · Workbench',
    data: { scope: 'workers' },
    loadComponent: () =>
      import('./pages/agent-list-page/agent-list-page').then((m) => m.AgentListPage),
  },
  {
    path: 'new',
    title: 'Nuevo agente · Workbench',
    data: { scope: 'workers' },
    loadComponent: () =>
      import('./pages/agent-form-page/agent-form-page').then((m) => m.AgentFormPage),
  },
  {
    path: ':id/edit',
    title: 'Editar agente · Workbench',
    data: { scope: 'workers' },
    loadComponent: () =>
      import('./pages/agent-form-page/agent-form-page').then((m) => m.AgentFormPage),
  },
];

export const AI_AGENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Agentes de IA · Workbench',
    loadComponent: () =>
      import('./pages/agent-list-page/agent-list-page').then((m) => m.AgentListPage),
  },
  {
    path: 'new',
    title: 'Nuevo agente · Workbench',
    loadComponent: () =>
      import('./pages/agent-form-page/agent-form-page').then((m) => m.AgentFormPage),
  },
  {
    path: ':id/edit',
    title: 'Editar agente · Workbench',
    loadComponent: () =>
      import('./pages/agent-form-page/agent-form-page').then((m) => m.AgentFormPage),
  },
];
