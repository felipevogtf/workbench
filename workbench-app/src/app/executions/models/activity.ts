import { JobSummary } from './execution';

export interface ActivityEvent {
  at: string | null;
  who: string;
  action: string;
  /** Markdown con el detalle (el resumen, las correcciones, el motivo del fallo). */
  detail: string | null;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

/**
 * La historia de un ticket, en el orden en que pasó, armada con sus trabajos: quién lo creó, quién lo
 * desarrolló, qué dijo cada revisión. `jobs` trae los del ticket y, si se quiere ver su origen, el de
 * crear los tickets. `who` da el nombre con que se muestra a un agente.
 */
export function activityOf(
  jobs: readonly JobSummary[],
  who: (agentId: string | null) => string,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const job of jobs) {
    const name = who(job.agentId);

    if (job.kind === 'tickets') {
      if (job.status === 'done') {
        events.push({
          at: job.finishedAt,
          who: name,
          action: 'creó los tickets de esta ejecución',
          detail: null,
          tone: 'neutral',
        });
      }
      continue;
    }
    if (job.kind === 'publish') continue;

    const label = job.kind === 'develop' ? 'el desarrollo' : 'la revisión';
    const retry = job.attempt > 1 ? ` (intento ${job.attempt})` : '';

    if (job.startedAt) {
      events.push({
        at: job.startedAt,
        who: name,
        action: `empezó ${label}${retry}`,
        detail: null,
        tone: 'neutral',
      });
    }

    if (job.status === 'failed') {
      events.push({
        at: job.finishedAt,
        who: name,
        action: `falló en ${label}`,
        detail: job.error,
        tone: 'danger',
      });
    } else if (job.status === 'cancelled') {
      events.push({
        at: job.finishedAt,
        who: name,
        action: 'fue cancelado',
        detail: null,
        tone: 'neutral',
      });
    } else if (job.status === 'done') {
      if (job.kind === 'develop') {
        events.push({
          at: job.finishedAt,
          who: name,
          action: 'terminó el desarrollo',
          detail: job.output,
          tone: 'success',
        });
      } else if (job.review?.approved) {
        events.push({
          at: job.finishedAt,
          who: name,
          action: 'aprobó el ticket',
          detail: job.review.summary || null,
          tone: 'success',
        });
      } else if (job.review) {
        const issues = job.review.issues.map((issue) => `- ${issue}`).join('\n');
        events.push({
          at: job.finishedAt,
          who: name,
          action: 'pidió cambios',
          detail: [job.review.summary, issues].filter(Boolean).join('\n\n') || null,
          tone: 'warning',
        });
      } else {
        events.push({
          at: job.finishedAt,
          who: name,
          action: 'terminó la revisión',
          detail: null,
          tone: 'neutral',
        });
      }
    }
  }

  // Por hora; los que no tienen, al final y sin cambiar su orden.
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const left = a.event.at ? Date.parse(a.event.at) : Infinity;
      const right = b.event.at ? Date.parse(b.event.at) : Infinity;
      return left - right || a.index - b.index;
    })
    .map(({ event }) => event);
}
