// Separación entre posiciones consecutivas de una columna. El hueco deja
// espacio para insertar sin renumerar, pero al mover se renumera la columna
// completa, así que nunca se agota.
export const COLUMN_POSITION_STEP = 1000;

/** Inserta `item` en `index` (limitado al rango) dentro de una copia de `column`. */
export function insertAt<T>(column: readonly T[], item: T, index: number): T[] {
  const result = [...column];
  result.splice(Math.min(Math.max(index, 0), result.length), 0, item);
  return result;
}

/** Posición de la tarjeta número `index` (desde 0) de una columna. */
export function positionAt(index: number): number {
  return (index + 1) * COLUMN_POSITION_STEP;
}
