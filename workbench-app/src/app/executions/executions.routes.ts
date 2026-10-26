import { Routes } from '@angular/router';

export const EXECUTIONS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'history' },
  {
    path: 'history',
    title: 'Ejecuciones · Workbench',
    loadComponent: () =>
      import('./pages/executions-page/executions-page').then((m) => m.ExecutionsPage),
  },
  {
    path: 'runners',
    title: 'Runners · Workbench',
    loadComponent: () => import('./pages/runners-page/runners-page').then((m) => m.RunnersPage),
  },
  {
    path: 'recipes',
    title: 'Recetas · Workbench',
    loadComponent: () => import('./pages/recipes-page/recipes-page').then((m) => m.RecipesPage),
  },
  {
    path: 'usage',
    title: 'Consumo · Workbench',
    loadComponent: () => import('./pages/usage-page/usage-page').then((m) => m.UsagePage),
  },
  {
    path: ':id',
    title: 'Ejecución · Workbench',
    loadComponent: () =>
      import('./pages/execution-page/execution-page').then((m) => m.ExecutionPage),
  },
];
