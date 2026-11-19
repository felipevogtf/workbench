import { Routes } from '@angular/router';

export const PROJECTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Proyectos · Workbench',
    loadComponent: () => import('./pages/projects-page/projects-page').then((m) => m.ProjectsPage),
  },
  {
    path: 'new',
    title: 'Nuevo proyecto · Workbench',
    loadComponent: () =>
      import('./pages/project-form-page/project-form-page').then((m) => m.ProjectFormPage),
  },
  {
    path: ':id/edit',
    title: 'Proyecto · Workbench',
    loadComponent: () =>
      import('./pages/project-form-page/project-form-page').then((m) => m.ProjectFormPage),
  },
];
