/** Máximo de tickets que se asocian a una PR (acota el contexto que recibe el agente). */
export const MAX_TICKETS_PER_PR = 5;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Códigos de ticket (`MEL-253`) presentes en los textos dados, en orden de aparición y sin repetidos.
 *
 * - Solo se aceptan los identificadores de proyecto que existen en Plane (`projectIdentifiers`),
 *   así `UTF-8` o `ES-2022` no se confunden con tickets.
 * - Formato `IDENTIFICADOR-NÚMERO` con guion, sin distinguir mayúsculas; se devuelve normalizado.
 * - Los textos se recorren en el orden recibido (rama primero, luego descripción) y los resultados se
 *   unen: un ticket en cada texto cuenta los dos.
 */
export function extractTicketKeys(
  texts: ReadonlyArray<string | null | undefined>,
  projectIdentifiers: readonly string[],
  max: number = MAX_TICKETS_PER_PR,
): string[] {
  // Del más largo al más corto para que `SERCSD` no se lea como `SER`.
  const identifiers = [
    ...new Set(
      projectIdentifiers
        .map((identifier) => identifier.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].sort((a, b) => b.length - a.length);
  if (identifiers.length === 0) return [];

  const pattern = new RegExp(
    `(?<![A-Za-z0-9])(${identifiers.map(escapeRegExp).join('|')})-(\\d{1,6})(?![A-Za-z0-9])`,
    'gi',
  );

  const keys: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(pattern)) {
      const key = `${match[1].toUpperCase()}-${Number(match[2])}`;
      if (!keys.includes(key)) keys.push(key);
      if (keys.length >= max) return keys;
    }
  }
  return keys;
}
