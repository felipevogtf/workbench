import { Routes } from '@angular/router';

export const ORGANIZER_ROUTES: Routes = [
  {
    path: '',
    title: 'Organizador · Workbench',
    loadComponent: () =>
      import('./pages/organizer-list-page/organizer-list-page').then((m) => m.OrganizerListPage),
  },
  {
    // Una conversación nueva: crea la sesión vacía y abre su pantalla. Va antes de `:id`.
    path: 'new',
    title: 'Nueva conversación · Workbench',
    loadComponent: () =>
      import('./pages/organizer-new-page/organizer-new-page').then((m) => m.OrganizerNewPage),
  },
  {
    path: ':id',
    title: 'Sesión · Workbench',
    // El chat usa todo el ancho, con el menú como panel flotante (como un tablero).
    data: { immersive: true },
    loadComponent: () =>
      import('./pages/organizer-page/organizer-page').then((m) => m.OrganizerPage),
  },
];
