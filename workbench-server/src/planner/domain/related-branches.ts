import { mentionedTicketKeys } from '@core/text/ticket-mentions';

/** Las ramas principales que el planificador ya lee por sí solo (las mismas que `REPO_BRANCHES` al clonar). */
const PRINCIPAL_BRANCHES = ['main', 'master'];

/** Una rama de otro ticket que la tarea menciona, clonada aparte para que el agente pueda leerla. */
export interface RelatedBranch {
  /** La clave del ticket que la nombra (p. ej. `MEL-466`). */
  key: string;
  branch: string;
  /** Carpeta donde quedó, junto a la del repo. */
  folder: string;
}

/** Cuántas ramas se clonan por repositorio (acota tiempo y disco). */
export const MAX_RELATED_BRANCHES_PER_REPO = 3;

const SAFE_BRANCH = /^[\w][\w./-]*$/;

/** Las claves de ticket (`MEL-466`) que aparecen en los textos, sin repetir y en orden de aparición. */
export function relatedKeysOf(
  texts: readonly (string | null | undefined)[],
): string[] {
  return mentionedTicketKeys(texts);
}

/** `true` si el nombre de la rama lleva la clave completa: `MEL-46` no vale para `feature/MEL-466/x`. */
export function branchHasKey(branch: string, key: string): boolean {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^0-9])`, 'i').test(branch);
}

/**
 * De las ramas del remoto, las que llevan alguna de las claves. El nombre viene de afuera y acaba como argumento de git:
 * solo pasan los que no empiezan con guion ni traen caracteres raros. Las ramas principales nunca cuentan.
 */
export function pickBranches(
  heads: readonly string[],
  keys: readonly string[],
): { key: string; branch: string }[] {
  const picked: { key: string; branch: string }[] = [];
  for (const key of keys) {
    for (const branch of heads) {
      if (
        PRINCIPAL_BRANCHES.includes(branch) ||
        !SAFE_BRANCH.test(branch) ||
        !branchHasKey(branch, key) ||
        picked.some((known) => known.branch === branch)
      ) {
        continue;
      }
      picked.push({ key, branch });
    }
  }
  return picked.slice(0, MAX_RELATED_BRANCHES_PER_REPO);
}

/** Los nombres de rama de la salida de `git ls-remote --heads`. */
export function headsOf(lsRemote: string): string[] {
  return lsRemote
    .split(/\r?\n/)
    .map((line) => /\trefs\/heads\/(.+)$/.exec(line)?.[1])
    .filter((branch): branch is string => Boolean(branch));
}
