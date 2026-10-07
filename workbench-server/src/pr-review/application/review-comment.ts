import type { Review } from '@pr-review/domain/entities/review.entity';

/** Texto que se publica en la PR: aviso de que es de IA, quién la hizo, hasta qué commit llegó y la revisión. */
export function buildCommentBody(review: Review, markdown: string): string {
  const info = [
    review.agentName ? `agente: ${review.agentName}` : null,
    review.model ? `modelo: ${review.model}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Hasta qué commit llegó la revisión: lo que se suba después no está cubierto.
  const reviewedCommit = review.commit
    ? `\n**Último commit revisado:** \`${review.commit.slice(0, 8)}\``
    : '';

  return (
    '**Revisión automática generada por IA** ' +
    '(borrador, puede contener errores)' +
    (info ? `\n_${info}_` : '') +
    reviewedCommit +
    `\n\n${markdown}`
  );
}
