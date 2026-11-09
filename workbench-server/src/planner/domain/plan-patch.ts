/**
 * Edición del plan por parches: en una replanificación la IA no escribe el plan entero, solo los fragmentos que cambian, en
 * bloques como estos (una respuesta puede traer varios):
 *
 *     <<<<<<< BUSCAR
 *     texto que está hoy en el plan, tal cual
 *     =======
 *     texto que lo reemplaza
 *     >>>>>>> REEMPLAZAR
 *
 * El servidor aplica los bloques al plan anterior. Son funciones puras: lo que no se pueda aplicar se informa para que la IA
 * lo corrija, y el plan no se toca hasta que todos los bloques entren.
 */

export interface PlanPatch {
  /** El fragmento actual del plan, tal cual aparece. */
  search: string;
  /** Con qué se reemplaza; vacío = borrarlo. */
  replace: string;
}

/** Un parche que no se puede aplicar. El mensaje está escrito para la IA: dice qué falló para que lo corrija. */
export class PlanPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanPatchError';
  }
}

const START = /^<{5,9}\s*(BUSCAR|SEARCH)\s*$/i;
const MIDDLE = /^={5,9}\s*$/;
const END = /^>{5,9}\s*(REEMPLAZAR|REPLACE)\s*$/i;

/** Marca de la respuesta de una IA que no tiene nada que cambiar. */
export const NO_CHANGES = /^\s*SIN CAMBIOS\b/i;

/** Los bloques de la respuesta, en orden. Vacío si no trae ninguno (la IA pudo entregar el plan completo). */
export function parsePlanPatches(output: string): PlanPatch[] {
  const patches: PlanPatch[] = [];
  let state: 'outside' | 'search' | 'replace' = 'outside';
  let search: string[] = [];
  let replace: string[] = [];

  for (const line of output.replace(/\r\n/g, '\n').split('\n')) {
    const marker = line.trim();
    if (state === 'outside') {
      if (START.test(marker)) {
        state = 'search';
        search = [];
        replace = [];
      }
    } else if (state === 'search') {
      if (MIDDLE.test(marker)) state = 'replace';
      else search.push(line);
    } else if (END.test(marker)) {
      patches.push({ search: search.join('\n'), replace: replace.join('\n') });
      state = 'outside';
    } else {
      replace.push(line);
    }
  }

  if (state !== 'outside') {
    throw new PlanPatchError(
      'El último bloque de edición quedó sin cerrar: cada bloque va de «<<<<<<< BUSCAR» a «>>>>>>> REEMPLAZAR», con «=======» en medio.',
    );
  }
  return patches;
}

/** Aplica los bloques en orden, cada uno sobre el resultado del anterior. Lanza `PlanPatchError` si alguno no entra. */
export function applyPlanPatches(
  content: string,
  patches: readonly PlanPatch[],
): string {
  let text = content.replace(/\r\n/g, '\n');
  patches.forEach((patch, index) => {
    const label = `El bloque ${index + 1}`;
    if (!patch.search.trim()) {
      throw new PlanPatchError(
        `${label} no dice qué fragmento reemplazar (BUSCAR está vacío). Copia el texto actual del plan que quieres cambiar.`,
      );
    }
    const found = locate(text, patch.search);
    if (found === 'many') {
      throw new PlanPatchError(
        `${label} es ambiguo: su BUSCAR aparece más de una vez en el plan. Incluye más líneas alrededor para que sea único.`,
      );
    }
    if (found === null) {
      throw new PlanPatchError(
        `${label} no coincide con el plan: no encontré este BUSCAR tal cual: «${excerpt(patch.search)}». Cópialo exactamente como está en el plan anterior (mismas palabras, signos y saltos de línea).`,
      );
    }
    text = text.slice(0, found.start) + patch.replace + text.slice(found.end);
  });
  return text;
}

interface Span {
  start: number;
  end: number;
}

/** Dónde está el fragmento: `null` si no está, `'many'` si está más de una vez. */
function locate(text: string, search: string): Span | 'many' | null {
  const exact = occurrences(text, search);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return 'many';
  return locateByLines(text, search);
}

function occurrences(text: string, search: string): Span[] {
  const spans: Span[] = [];
  for (
    let at = text.indexOf(search);
    at !== -1;
    at = text.indexOf(search, at + 1)
  ) {
    spans.push({ start: at, end: at + search.length });
  }
  return spans;
}

/** Si no hay coincidencia exacta, se ignoran los espacios al final de cada línea y las líneas vacías de los extremos. */
function locateByLines(text: string, search: string): Span | 'many' | null {
  const wanted = search
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());
  while (wanted.length > 0 && wanted[0] === '') wanted.shift();
  while (wanted.length > 0 && wanted[wanted.length - 1] === '') wanted.pop();
  if (wanted.length === 0) return null;

  const lines = text.split('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }

  const spans: Span[] = [];
  for (let first = 0; first + wanted.length <= lines.length; first++) {
    const matches = wanted.every(
      (line, i) => lines[first + i].trimEnd() === line,
    );
    if (!matches) continue;
    const last = first + wanted.length - 1;
    spans.push({
      start: starts[first],
      end: starts[last] + lines[last].length,
    });
  }
  if (spans.length === 0) return null;
  return spans.length === 1 ? spans[0] : 'many';
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}
