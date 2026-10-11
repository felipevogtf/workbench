import { Routes } from '@angular/router';

export const CREDENTIALS_ROUTES: Routes = [
  {
    path: '',
    title: 'Credenciales · Workbench',
    loadComponent: () =>
      import('./pages/credential-list-page/credential-list-page').then((m) => m.CredentialListPage),
  },
];
