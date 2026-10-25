import { AI_AGENTS_ROUTES, WORKER_AGENTS_ROUTES } from './ai-agents.routes';

describe('the routes of the agents', () => {
  // Sin `data.scope` el componente recibe `undefined` y el botón de volver se queda sin enlace.
  it('say which list they belong to, so every page knows where to go back to', () => {
    expect(AI_AGENTS_ROUTES.map((route) => route.data?.['scope'])).toEqual([
      'general',
      'general',
      'general',
    ]);
    expect(WORKER_AGENTS_ROUTES.map((route) => route.data?.['scope'])).toEqual([
      'workers',
      'workers',
      'workers',
    ]);
  });
});
