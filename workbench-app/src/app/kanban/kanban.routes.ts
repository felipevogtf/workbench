import { Routes } from '@angular/router';

export const KANBAN_ROUTES: Routes = [
  {
    path: '',
    title: 'Kanban · Workbench',
    loadComponent: () =>
      import('./pages/board-list-page/board-list-page').then((m) => m.BoardListPage),
  },
  {
    path: ':boardId',
    title: 'Tablero · Workbench',
    // El shell muestra este tablero a ancho completo, con el menú como panel flotante.
    data: { immersive: true },
    loadComponent: () => import('./pages/board-page/board-page').then((m) => m.BoardPage),
  },
];
