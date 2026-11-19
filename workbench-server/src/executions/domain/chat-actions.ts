import { ExecutionTicket, TicketLevel } from './entities/execution.props';
import { unformatted } from './chat-proposals';

/**
 * Lo que Lucy hace sobre los tickets de un borrador. A diferencia de las propuestas (una nota, un ticket de una ejecución ya
 * completada), que el usuario confirma con un botón, estas se aplican solas: el historial permite deshacerlas.
 *
 * Los números son los del listado que Lucy vio al contestar: no cambian mientras se aplican las demás líneas de la misma respuesta.
 */
export type LucyAction =
  | {
      kind: 'create';
      title: string;
      text: string;
      level: TicketLevel;
      /** `organización/repo`; `null` = el primero. */
      repo: string | null;
    }
  | {
      kind: 'update';
      ticketId: string;
      ticket: number;
      field: 'title' | 'description' | 'criteria' | 'level' | 'repo';
      value: string | string[];
    }
  | { kind: 'remove'; ticketId: string; ticket: number }
  | {
      kind: 'assign';
      ticketId: string;
      ticket: number;
      role: 'developer' | 'reviewer';
      /** Cómo la llamó Lucy: el nombre con que se ve al agente. */
      agent: string;
    }
  | { kind: 'note'; ticketId: string; ticket: number; text: string };

/** Lo que se hizo con una acción de Lucy: el cambio del historial, para mostrarlo y poder deshacerlo. */
export interface AppliedAction {
  changeId: string;
  kind: 'create' | 'update' | 'remove' | 'assign' | 'note';
  /** El número del ticket tal como lo vio Lucy; `null` en uno recién creado. */
  ticket: number | null;
  summary: string;
}

/** Una acción que no se pudo aplicar, y por qué. */
export interface RejectedAction {
  action: LucyAction;
  reason: string;
}

export interface ActionContext {
  tickets: readonly ExecutionTicket[];
  /** Los repositorios de la tarea, `organización/repo`. */
  repos: readonly string[];
}

const MAX_ACTIONS = 12;
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4_000;
const MAX_NOTE = 2_000;
const MAX_CRITERIA = 10;

const LEVELS: Record<string, TicketLevel> = {
  simple: 'simple',
  medium: 'medium',
  medio: 'medium',
  complex: 'complex',
  complejo: 'complex',
};

const CREATE =
  /^[ \t]*(?:CREAR|TICKET)[ \t]*(simple|medium|medio|complex|complejo)?[ \t]*\|[ \t]*([^|]+?)[ \t]*\|[ \t]*(.+?)[ \t]*$/i;
const EDIT =
  /^[ \t]*EDITAR[ \t]+(\d+)[ \t]*\|[ \t]*(t[ií]tulo|descripci[oó]n|criterios|nivel|repo)[ \t]*\|[ \t]*(.+?)[ \t]*$/i;
const REMOVE = /^[ \t]*ELIMINAR[ \t]+(\d+)[ \t]*$/i;
const ASSIGN =
  /^[ \t]*REASIGNAR[ \t]+(\d+)[ \t]*\|[ \t]*(desarrolla(?:dor)?|revisa(?:dor)?)[ \t]*\|[ \t]*(.+?)[ \t]*$/i;
const NOTE = /^[ \t]*NOTA[ \t]+(\d+)[ \t]*:[ \t]*(.+?)[ \t]*$/i;
const REPO_NAME = /^[\w.-]+\/[\w.-]+$/;

/**
 * Separa de la respuesta de Lucy las líneas que son acciones y no texto para leer:
 * - `CREAR <simple|medium|complex> | <título> | <descripción en una línea> [| <organización/repo>]`
 * - `EDITAR <n> | <título|descripción|criterios|nivel|repo> | <valor>` (los criterios, separados por `;`)
 * - `ELIMINAR <n>`
 * - `REASIGNAR <n> | <desarrolla|revisa> | <nombre del agente>`
 * - `NOTA <n>: <instrucción>`
 *
 * Una línea que no se puede entender (un ticket que no existe, un campo que no es) se deja en la respuesta, a la vista, en vez de
 * aplicar algo a medias.
 */
export function extractActions(
  reply: string,
  context: ActionContext,
): { reply: string; actions: LucyAction[] } {
  const actions: LucyAction[] = [];
  const kept: string[] = [];

  for (const line of reply.split(/\r?\n/)) {
    const action =
      actions.length < MAX_ACTIONS
        ? actionOf(unformatted(line), context)
        : null;
    if (action) actions.push(action);
    else kept.push(line);
  }
  // Donde estaban las líneas de acción quedan huecos: no más de una línea en blanco seguida.
  const text = withoutEmptyFences(kept.join('\n')).replace(/\n{3,}/g, '\n\n');
  return { reply: text.trim(), actions };
}

/** Si Lucy puso sus líneas dentro de un bloque de código, al sacarlas queda el bloque vacío: se quita. */
function withoutEmptyFences(text: string): string {
  return text.replace(/```[a-z]*[ \t]*\r?\n?[ \t]*```/gi, '');
}

function ticketAt(
  context: ActionContext,
  number: string,
): ExecutionTicket | null {
  return context.tickets[Number(number) - 1] ?? null;
}

function actionOf(line: string, context: ActionContext): LucyAction | null {
  const created = CREATE.exec(line);
  if (created) {
    let description = created[3];
    let wanted: string | undefined;
    const cut = description.lastIndexOf('|');
    if (cut >= 0) {
      const tail = description.slice(cut + 1).trim();
      // Un último campo con forma de repo lo es; si no, sigue siendo parte de la descripción (puede llevar `|`).
      if (REPO_NAME.test(tail)) {
        wanted = tail.toLowerCase();
        description = description.slice(0, cut).trim();
      }
    }
    if (!description) return null;
    return {
      kind: 'create',
      title: created[2].slice(0, MAX_TITLE),
      text: description.slice(0, MAX_DESCRIPTION),
      level: LEVELS[created[1]?.toLowerCase() ?? ''] ?? 'medium',
      repo: context.repos.find((repo) => repo.toLowerCase() === wanted) ?? null,
    };
  }

  const edited = EDIT.exec(line);
  if (edited) {
    const ticket = ticketAt(context, edited[1]);
    if (!ticket) return null;
    const name = edited[2].toLowerCase();
    const value = edited[3];
    if (name.startsWith('t')) {
      return {
        kind: 'update',
        ticketId: ticket.id,
        ticket: Number(edited[1]),
        field: 'title',
        value: value.slice(0, MAX_TITLE),
      };
    }
    if (name.startsWith('d')) {
      return {
        kind: 'update',
        ticketId: ticket.id,
        ticket: Number(edited[1]),
        field: 'description',
        value: value.slice(0, MAX_DESCRIPTION),
      };
    }
    if (name === 'criterios') {
      const criteria = value
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, MAX_CRITERIA);
      if (criteria.length === 0) return null;
      return {
        kind: 'update',
        ticketId: ticket.id,
        ticket: Number(edited[1]),
        field: 'criteria',
        value: criteria,
      };
    }
    if (name === 'nivel') {
      const level = LEVELS[value.toLowerCase()];
      if (!level) return null;
      return {
        kind: 'update',
        ticketId: ticket.id,
        ticket: Number(edited[1]),
        field: 'level',
        value: level,
      };
    }
    // repo
    const repo = context.repos.find(
      (each) => each.toLowerCase() === value.toLowerCase(),
    );
    if (!repo) return null;
    return {
      kind: 'update',
      ticketId: ticket.id,
      ticket: Number(edited[1]),
      field: 'repo',
      value: repo,
    };
  }

  const removed = REMOVE.exec(line);
  if (removed) {
    const ticket = ticketAt(context, removed[1]);
    return ticket
      ? { kind: 'remove', ticketId: ticket.id, ticket: Number(removed[1]) }
      : null;
  }

  const assigned = ASSIGN.exec(line);
  if (assigned) {
    const ticket = ticketAt(context, assigned[1]);
    if (!ticket) return null;
    return {
      kind: 'assign',
      ticketId: ticket.id,
      ticket: Number(assigned[1]),
      role: assigned[2].toLowerCase().startsWith('desarrolla')
        ? 'developer'
        : 'reviewer',
      agent: assigned[3],
    };
  }

  const note = NOTE.exec(line);
  if (note) {
    const ticket = ticketAt(context, note[1]);
    return ticket
      ? {
          kind: 'note',
          ticketId: ticket.id,
          ticket: Number(note[1]),
          text: note[2].slice(0, MAX_NOTE),
        }
      : null;
  }
  return null;
}
