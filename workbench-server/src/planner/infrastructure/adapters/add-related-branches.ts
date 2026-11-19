import { join } from 'node:path';
import { RepoMirrorService } from '@core/git/repo-mirror';
import { pickBranches, RelatedBranch } from '@planner/domain/related-branches';

/**
 * Deja a la vista, aparte y de solo lectura, las ramas del repo que llevan alguna de las claves de ticket que la tarea menciona
 * (`MEL-466` -> `feature/MEL-466/…`), cada una en un worktree junto al del repo: `<repo>@<clave>`. Así el agente puede leer con `Read`
 * y `Grep` lo que de esa rama depende la tarea, que no está en la rama principal. El mirror ya trae todas las ramas: no se clona nada.
 *
 * Nunca falla: sin la rama o con cualquier error el plan sigue con lo que ya tiene.
 */
export async function addRelatedBranches(options: {
  mirror: RepoMirrorService;
  mirrorPath: string;
  /** Carpeta que contiene a todos los repos. */
  parent: string;
  repoName: string;
  keys: readonly string[];
  warn: (message: string) => void;
}): Promise<RelatedBranch[]> {
  const { mirror, mirrorPath, parent, repoName, keys, warn } = options;
  if (keys.length === 0) return [];

  try {
    const picked = pickBranches(await mirror.branches(mirrorPath), keys);

    const added: RelatedBranch[] = [];
    for (const { key, branch } of picked) {
      const same = added.filter((known) => known.key === key).length;
      const folder = `${repoName}@${key}${same > 0 ? `-${same + 1}` : ''}`;
      const dest = join(parent, folder);
      try {
        await mirror.addWorktree(mirrorPath, dest, branch);
        added.push({ key, branch, folder });
      } catch (error) {
        await mirror.removeWorktree(mirrorPath, dest);
        warn(
          `Could not open the branch ${branch} of ${repoName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return added;
  } catch (error) {
    warn(
      `Could not look for the related branches of ${repoName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}
