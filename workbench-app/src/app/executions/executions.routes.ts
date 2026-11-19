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
    path: 'usage',
    title: 'Consumo · Workbench',
    loadComponent: () => import('./pages/usage-page/usage-page').then((m) => m.UsagePage),
  },
  {
    path: ':id',
    title: 'Ejecución · Workbench',
    // Ancho completo, como el tablero y el organizador: el chat de Lucy es un cajón al costado.
    data: { immersive: true },
    loadComponent: () =>
      import('./pages/execution-page/execution-page').then((m) => m.ExecutionPage),
  },
];
