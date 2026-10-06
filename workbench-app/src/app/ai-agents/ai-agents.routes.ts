import { Routes } from '@angular/router';

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
