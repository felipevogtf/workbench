import { DomainError } from '@core/domain/domain.error';
import {
  FINDING_SEVERITIES,
  FinalReviewFinding,
  TICKET_LEVELS,
  TicketLevel,
} from './entities/execution.props';

export interface TicketDraft {
  title: string;
  description: string;
  level: TicketLevel;
  /** Solo cuando la tarea tiene varios repositorios: en cuál se desarrolla. */
  repo?: string;
  criteria: string[];
  /** Por dónde empezar: archivos o carpetas que Lucy espera que intervengan. Es una pista, no un límite. */
  files: string[];
}

export interface ReviewVerdict {
  approved: boolean;
  summary: string;
  issues: string[];
  /** Lo que el revisor dejó dudoso sin que impida aprobar; vacío si nada. */
  doubts: string;
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;
const MAX_CRITERION = 400;
const MAX_CRITERIA = 10;
const MAX_FILES = 15;
const MAX_FILE = 200;
const MAX_ISSUES = 15;
const MAX_FINDINGS = 20;
const MAX_QUESTION = 1_500;

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
export function parseTickets(
  output: string,
  max: number,
  repos: readonly string[] = [],
): TicketDraft[] {
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
        // Sin un nivel válido, el medio: ni el más caro ni el más flojo.
        level: TICKET_LEVELS.find((level) => level === item.level) ?? 'medium',
        // Con varios repos, el ticket va al que nombra; sin uno válido, al primero.
        ...(repos.length > 1
          ? { repo: repos.find((name) => name === item.repo) ?? repos[0] }
          : {}),
        criteria: list(item.criteria, MAX_CRITERIA, MAX_CRITERION),
        files: list(item.files, MAX_FILES, MAX_FILE),
      };
    })
    .filter((ticket) => ticket.title && ticket.description);

  if (tickets.length === 0) {
    throw new DomainError('The agent did not create any valid ticket');
  }
  return tickets.slice(0, max);
}

/** El informe de la revisión final: un resumen y los hallazgos, los más graves primero. */
export interface FinalReviewReport {
  summary: string;
  findings: FinalReviewFinding[];
}

/** El informe del revisor final. Sin una lista `findings` no es un informe. */
export function parseFinalReview(output: string): FinalReviewReport {
  const json = extractJson(output) as Record<string, unknown> | null;
  if (!json || !Array.isArray(json.findings)) {
    throw new DomainError('The final review answer has no "findings" list');
  }

  const findings = json.findings
    .map((raw): FinalReviewFinding => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return {
        // Sin una gravedad válida, la del medio: ni se exagera ni se resta.
        severity:
          FINDING_SEVERITIES.find((severity) => severity === item.severity) ??
          'medium',
        file: text(item.file, MAX_FILE) || null,
        issue: text(item.issue, MAX_DESCRIPTION),
        suggestion: text(item.suggestion, MAX_DESCRIPTION),
      };
    })
    .filter((finding) => finding.issue)
    .sort(
      (a, b) =>
        FINDING_SEVERITIES.indexOf(a.severity) -
        FINDING_SEVERITIES.indexOf(b.severity),
    )
    .slice(0, MAX_FINDINGS);

  return { summary: text(json.summary, MAX_DESCRIPTION), findings };
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
    doubts: text(json.doubts, MAX_QUESTION),
  };
}

/**
 * La pregunta con que un desarrollador termina cuando no puede seguir sin una respuesta: una línea
 * `PREGUNTA: …` (que puede seguir en las líneas siguientes). `null` si no preguntó.
 */
export function parseQuestion(output: string): string | null {
  const match = /^[ \t]*PREGUNTA[ \t]*:[ \t]*([\s\S]+)$/im.exec(output);
  const text = match?.[1].trim().slice(0, MAX_QUESTION);
  return text || null;
}

/**
 * Lo que el desarrollador dejó dudoso aunque avanzó (un supuesto, algo sin probar): una línea `DUDAS: …` que puede
 * seguir en las líneas siguientes. `null` si no dejó ninguna.
 */
export function parseDoubts(output: string): string | null {
  const match = /^[ \t]*DUDAS[ \t]*:[ \t]*([\s\S]+)$/im.exec(output);
  const doubt = match?.[1].trim().slice(0, MAX_QUESTION);
  return doubt || null;
}

/** Lo que Lucy decide ante una pregunta: contestarla ella (el plan lo dice) o escalarla al usuario. */
export interface LucyDecision {
  kind: 'answer' | 'escalate';
  text: string;
}

/** `RESPUESTA: …` o `ESCALAR: …` (con su recomendación). Sin ninguna de las dos, `null`. */
export function parseDecision(output: string): LucyDecision | null {
  const match = /^[ \t]*(RESPUESTA|ESCALAR)[ \t]*:[ \t]*([\s\S]+)$/im.exec(
    output,
  );
  const text = match?.[2].trim().slice(0, MAX_QUESTION);
  if (!match || !text) return null;
  return {
    kind: match[1].toUpperCase() === 'RESPUESTA' ? 'answer' : 'escalate',
    text,
  };
}
