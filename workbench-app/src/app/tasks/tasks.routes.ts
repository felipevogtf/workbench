import { Routes } from '@angular/router';

export const TASKS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'issues' },
  {
    path: 'issues',
    title: 'Tareas · Workbench',
    loadComponent: () =>
      import('./pages/issue-list-page/issue-list-page').then((m) => m.IssueListPage),
  },
  {
    path: 'issues/:id',
    title: 'Tarea · Workbench',
    loadComponent: () =>
      import('./pages/issue-detail-page/issue-detail-page').then((m) => m.IssueDetailPage),
  },
  {
    path: 'projects',
    title: 'Proyectos · Workbench',
    loadComponent: () =>
      import('./pages/project-list-page/project-list-page').then((m) => m.ProjectListPage),
  },
  {
    path: 'states',
    title: 'Estados · Workbench',
    loadComponent: () =>
      import('./pages/state-list-page/state-list-page').then((m) => m.StateListPage),
  },
  {
    path: 'labels',
    title: 'Etiquetas · Workbench',
    loadComponent: () =>
      import('./pages/label-list-page/label-list-page').then((m) => m.LabelListPage),
  },
];
