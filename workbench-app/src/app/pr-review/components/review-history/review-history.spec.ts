import { TestBed } from '@angular/core/testing';
import { Review } from '../../models/pull-request';
import { ReviewHistory } from './review-history';

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    pullRequestId: 'p1',
    commit: 'abc12345def6',
    agentId: null,
    agentName: 'default-reviewer',
    model: 'claude-sonnet-5-5',
    docPath: 'a.md',
    status: 'ok',
    error: null,
    commentStatus: 'posted',
    commentUrl: 'https://example.test/comment',
    commentError: null,
    tickets: [],
    createdAt: '2026-10-06T12:00:00Z',
    ...overrides,
  };
}

describe('ReviewHistory tickets', () => {
  async function render(reviews: Review[]): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ReviewHistory);
    fixture.componentRef.setInput('reviews', reviews);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the tickets the agent evaluated, marking the ones it could not read', async () => {
    const element = await render([
      review({
        tickets: [
          {
            key: 'MEL-253',
            url: 'https://plane.test/ws/browse/MEL-253/',
            title: 'Entidad Maestro',
            state: 'En revisión',
            found: true,
          },
          {
            key: 'MEL-999',
            url: 'https://plane.test/ws/browse/MEL-999/',
            title: null,
            state: null,
            found: false,
          },
        ],
      }),
    ]);
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.item__tickets a'));

    expect(links.map((a) => a.textContent?.trim())).toEqual(['MEL-253', 'MEL-999']);
    expect(links[0].title).toBe('Entidad Maestro');
    expect(links[0].classList.contains('is-missing')).toBe(false);
    expect(links[1].classList.contains('is-missing')).toBe(true);
    expect(links[1].title).toBe('No se pudo leer este ticket');
  });

  it('says there were no tickets when the review had none', async () => {
    const element = await render([review()]);

    expect(element.querySelector('.item__tickets')?.textContent).toContain('ninguno');
  });
});
