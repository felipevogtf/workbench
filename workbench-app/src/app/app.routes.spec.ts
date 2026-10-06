import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Igual que app.config.ts: el `:id` de la ruta llega como input del componente.
        provideRouter(routes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  async function open(url: string): Promise<string> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return (harness.routeNativeElement as HTMLElement).tagName.toLowerCase();
  }

  it('redirects the root to the pull requests list', async () => {
    expect(await open('/')).toBe('app-pull-request-list-page');
  });

  it('lazy loads the agents list at /agents', async () => {
    expect(await open('/agents')).toBe('app-agent-list-page');
  });

  it('lazy loads the agent form at /agents/new', async () => {
    expect(await open('/agents/new')).toBe('app-agent-form-page');
  });

  it('lazy loads the agent form at /agents/:id/edit', async () => {
    expect(await open('/agents/abc/edit')).toBe('app-agent-form-page');
  });

  it('opens a pull request detail by id', async () => {
    expect(await open('/pull-requests/123')).toBe('app-pull-request-detail-page');
  });

  it('shows the not found page for unknown paths', async () => {
    expect(await open('/nope')).toBe('app-not-found-page');
  });
});
