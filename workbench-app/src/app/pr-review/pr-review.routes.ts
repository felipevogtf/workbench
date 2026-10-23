import { Routes } from '@angular/router';

export const PR_REVIEW_ROUTES: Routes = [
  {
    path: '',
    title: 'Pull requests · Workbench',
    loadComponent: () =>
      import('./pages/pull-request-list-page/pull-request-list-page').then(
        (m) => m.PullRequestListPage,
      ),
  },
  {
    path: ':id/diff',
    title: 'Cambios · Workbench',
    loadComponent: () =>
      import('./pages/pull-request-diff-page/pull-request-diff-page').then(
        (m) => m.PullRequestDiffPage,
      ),
  },
  {
    path: ':id',
    title: 'Pull request · Workbench',
    loadComponent: () =>
      import('./pages/pull-request-detail-page/pull-request-detail-page').then(
        (m) => m.PullRequestDetailPage,
      ),
  },
];
