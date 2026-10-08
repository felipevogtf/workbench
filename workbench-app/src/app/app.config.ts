import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { apiErrorInterceptor } from '@core/api/api-error.interceptor';
import { provideNavItem } from '@core/navigation/nav-item';
import { DASHBOARD_NAV } from '@dashboard/dashboard.nav';
import { TASKS_NAV } from '@tasks/tasks.nav';
import { KANBAN_NAV } from '@kanban/kanban.nav';
import { PR_REVIEW_NAV } from '@pr-review/pr-review.nav';
import { AI_AGENTS_NAV } from '@ai-agents/ai-agents.nav';
import { routes } from './app.routes';

// Zoneless: en Angular 21 es el comportamiento por defecto (no hay zone.js en el proyecto).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([apiErrorInterceptor])),
    provideNavItem(DASHBOARD_NAV),
    provideNavItem(TASKS_NAV),
    provideNavItem(KANBAN_NAV),
    provideNavItem(PR_REVIEW_NAV),
    provideNavItem(AI_AGENTS_NAV),
  ],
};
