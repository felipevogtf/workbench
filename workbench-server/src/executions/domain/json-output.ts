import { DomainError } from '@core/domain/domain.error';

export interface TicketDraft {
  title: string;
  description: string;
  criteria: string[];
}

export interface ReviewVerdict {
  approved: boolean;
  summary: string;
  issues: string[];
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;
const MAX_CRITERION = 400;
const MAX_CRITERIA = 10;
const MAX_ISSUES = 15;

/**
 * El JSON de la respuesta de un agente: dentro de un bloque ```json o, si no, entre la primera llave y
 * la última. Los modelos suelen agregar texto alrededor aunque se les pida solo JSON.
 */
export function extractJson(text: string): unknown {
  const candidates: string[] = [];

  const fenced = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of text.matchAll(fenced)) candidates.push(match[1].trim());

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first)
    candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // se prueba el siguiente
    }
  }
  const start = text.trim().replace(/\s+/g, ' ');
  throw new DomainError(
    `The agent did not answer with valid JSON. Start of its answer: ${start.slice(0, 200)}`,
  );
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function list(value: unknown, max: number, itemMax: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item, itemMax))
    .filter(Boolean)
    .slice(0, max);
}

/** Los tickets que creó el agente, validados y sin pasarse de `max`. */
export function parseTickets(output: string, max: number): TicketDraft[] {
  const json = extractJson(output) as { tickets?: unknown } | null;
  if (!json || !Array.isArray(json.tickets)) {
    throw new DomainError('The agent answer has no "tickets" list');
  }

  const tickets = json.tickets
    .map((raw): TicketDraft => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return {
        title: text(item.title, MAX_TITLE),
        description: text(item.description, MAX_DESCRIPTION),
        criteria: list(item.criteria, MAX_CRITERIA, MAX_CRITERION),
      };
    })
    .filter((ticket) => ticket.title && ticket.description);

  if (tickets.length === 0) {
    throw new DomainError('The agent did not create any valid ticket');
  }
  return tickets.slice(0, max);
}

/** El veredicto del revisor. Sin un `approved` booleano claro no se da por aprobado. */
export function parseReview(output: string): ReviewVerdict {
  const json = extractJson(output) as Record<string, unknown> | null;
  if (!json || typeof json.approved !== 'boolean') {
    throw new DomainError('The reviewer answer has no "approved" verdict');
  }

  return {
    approved: json.approved,
    summary: text(json.summary, MAX_DESCRIPTION),
    issues: list(json.issues, MAX_ISSUES, MAX_DESCRIPTION),
  };
}
