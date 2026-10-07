import type { Review } from '@pr-review/domain/entities/review.entity';
import { buildCommentBody } from './review-comment';

const review = (
  props: Partial<Pick<Review, 'agentName' | 'model' | 'commit'>>,
) => props as Review;

describe('buildCommentBody', () => {
  it('warns that it is AI generated and appends the review', () => {
    const body = buildCommentBody(review({}), 'contenido');

    expect(body).toContain('**Revisión automática generada por IA**');
    expect(body.endsWith('\n\ncontenido')).toBe(true);
  });

  it('shows agent and model when known', () => {
    const body = buildCommentBody(
      review({ agentName: 'Revisor', model: 'sonnet' }),
      'x',
    );

    expect(body).toContain('_agente: Revisor · modelo: sonnet_');
  });

  it('cuts the reviewed commit to 8 characters', () => {
    const body = buildCommentBody(review({ commit: '0123456789abcdef' }), 'x');

    expect(body).toContain('**Último commit revisado:** `01234567`');
    expect(body).not.toContain('89abcdef');
  });
});
