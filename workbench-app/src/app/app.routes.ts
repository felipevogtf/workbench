import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadChildren: () => import('@dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'tasks',
    loadChildren: () => import('@tasks/tasks.routes').then((m) => m.TASKS_ROUTES),
  },
  {
    path: 'kanban',
    loadChildren: () => import('@kanban/kanban.routes').then((m) => m.KANBAN_ROUTES),
  },
  {
    path: 'pull-requests',
    loadChildren: () => import('@pr-review/pr-review.routes').then((m) => m.PR_REVIEW_ROUTES),
  },
  {
    // Antes que `executions`: los trabajadores los sirve el módulo ai-agents.
    path: 'executions/agents',
    loadChildren: () => import('@ai-agents/ai-agents.routes').then((m) => m.AI_AGENTS_ROUTES),
  },
  {
    path: 'executions',
    loadChildren: () => import('@executions/executions.routes').then((m) => m.EXECUTIONS_ROUTES),
  },
  // Los enlaces de antes, cuando los agentes tenían su propio menú.
  { path: 'agents', redirectTo: 'executions/agents', pathMatch: 'full' },
  { path: 'agents/new', redirectTo: 'executions/agents/new', pathMatch: 'full' },
  { path: 'agents/:id/edit', redirectTo: 'executions/agents/:id/edit', pathMatch: 'full' },
  {
    path: 'credentials',
    loadChildren: () => import('@credentials/credentials.routes').then((m) => m.CREDENTIALS_ROUTES),
  },
  {
    path: '**',
    title: 'No encontrado · Workbench',
    loadComponent: () =>
      import('@core/pages/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
