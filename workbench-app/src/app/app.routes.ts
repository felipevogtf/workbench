import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pull-requests' },
  {
    path: 'pull-requests',
    loadChildren: () => import('@pr-review/pr-review.routes').then((m) => m.PR_REVIEW_ROUTES),
  },
  {
    path: 'agents',
    loadChildren: () => import('@ai-agents/ai-agents.routes').then((m) => m.AI_AGENTS_ROUTES),
  },
  {
    path: '**',
    title: 'No encontrado · Workbench',
    loadComponent: () =>
      import('@core/pages/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
