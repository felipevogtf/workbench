import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNavItem } from '@core/navigation/nav-item';
import { AI_AGENTS_NAV } from '@ai-agents/ai-agents.nav';
import { PR_REVIEW_NAV } from '@pr-review/pr-review.nav';
import { KANBAN_NAV } from '@kanban/kanban.nav';
import { TASKS_NAV } from '@tasks/tasks.nav';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        // Orden inverso a propósito: el sidebar debe ordenar por `order`.
        provideNavItem(AI_AGENTS_NAV),
        provideNavItem(PR_REVIEW_NAV),
        provideNavItem(KANBAN_NAV),
        provideNavItem(TASKS_NAV),
      ],
    });
  });

  it('shows the registered modules in the sidebar, ordered', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav .nav-link'),
    ).map((link) => link.textContent?.trim());

    expect(links).toEqual(['Gestión', 'Kanban', 'Pull requests', 'Agentes de IA']);
  });

  it('renders the shell around the routed content', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('main#main')).not.toBeNull();
    expect(element.querySelector('app-toast-host')).not.toBeNull();
  });
});
