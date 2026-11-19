import { Routes } from '@angular/router';

export const PROJECTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Proyectos · Workbench',
    loadComponent: () =>
      import('./pages/projects-page/projects-page').then((m) => m.ProjectsPage),
  },
];
