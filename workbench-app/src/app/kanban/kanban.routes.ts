import { Routes } from '@angular/router';

export const KANBAN_ROUTES: Routes = [
  {
    path: '',
    title: 'Kanban · Workbench',
    loadComponent: () => import('./pages/board-page/board-page').then((m) => m.BoardPage),
  },
  {
    path: ':boardId',
    title: 'Kanban · Workbench',
    loadComponent: () => import('./pages/board-page/board-page').then((m) => m.BoardPage),
  },
];
