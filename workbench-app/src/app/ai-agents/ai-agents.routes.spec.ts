import { AI_AGENTS_ROUTES } from './ai-agents.routes';

describe('the routes of the workers', () => {
  it('are the list, a new worker and the detail of each one', () => {
    expect(AI_AGENTS_ROUTES.map((route) => route.path)).toEqual(['', 'new', ':id/edit']);
  });
});
