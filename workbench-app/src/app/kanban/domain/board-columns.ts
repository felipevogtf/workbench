import type { Issue, State } from '@tasks/index';
import { BoardCard } from '../models/board';

/** Clave de la columna de las tareas sin estado. */
export const NO_STATE_KEY = 'none';

/** Separación de posiciones en una columna; el servidor renumera con el mismo valor. */
export const POSITION_STEP = 1000;

export interface Column {
  /** Id del estado, o `NO_STATE_KEY`. */
  key: string;
  stateId: string | null;
  name: string;
  color: string | null;
  /** Las tareas de esta columna están finalizadas. */
  isFinal: boolean;
  /** Ids de las tareas, en el orden en que se muestran. */
  issueIds: string[];
}

export function positionAt(index: number): number {
  return (index + 1) * POSITION_STEP;
}

/**
 * Arma las columnas del tablero: una por estado (en el orden de los estados) y, si hay tareas sin
 * estado, una «Sin estado» al comienzo. Las tarjetas cuya tarea ya no existe se ignoran.
 */
export function buildColumns(
  cards: readonly BoardCard[],
  issues: ReadonlyMap<string, Pick<Issue, 'stateId'>>,
  states: readonly State[],
): Column[] {
  const byState = new Map<string, BoardCard[]>();
  for (const card of cards) {
    const issue = issues.get(card.issueId);
    if (!issue) continue;
    // Un estado que ya no existe equivale a no tener estado.
    const key =
      issue.stateId && states.some((state) => state.id === issue.stateId)
        ? issue.stateId
        : NO_STATE_KEY;
    byState.set(key, [...(byState.get(key) ?? []), card]);
  }

  const toIds = (key: string) =>
    (byState.get(key) ?? [])
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
      .map((card) => card.issueId);

  const columns: Column[] = [...states]
    .sort((a, b) => a.position - b.position)
    .map((state) => ({
      key: state.id,
      stateId: state.id,
      name: state.name,
      color: state.color,
      isFinal: state.isFinal,
      issueIds: toIds(state.id),
    }));

  const unassigned = toIds(NO_STATE_KEY);
  if (unassigned.length > 0) {
    columns.unshift({
      key: NO_STATE_KEY,
      stateId: null,
      name: 'Sin estado',
      color: null,
      isFinal: false,
      issueIds: unassigned,
    });
  }
  return columns;
}

/** Devuelve las columnas con la tarea movida a `targetKey` en el lugar `index` (limitado al rango). */
export function applyMove(
  columns: readonly Column[],
  issueId: string,
  targetKey: string,
  index: number,
): Column[] {
  if (!columns.some((column) => column.key === targetKey)) return [...columns];

  return columns.map((column) => {
    const without = column.issueIds.filter((id) => id !== issueId);
    if (column.key !== targetKey) return { ...column, issueIds: without };

    const at = Math.min(Math.max(index, 0), without.length);
    return { ...column, issueIds: [...without.slice(0, at), issueId, ...without.slice(at)] };
  });
}

/** Columna que contiene la tarea, o `undefined`. */
export function columnOf(columns: readonly Column[], issueId: string): Column | undefined {
  return columns.find((column) => column.issueIds.includes(issueId));
}
