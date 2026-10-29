import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runGit } from '@core/git/run-git';
import {
  headsOf,
  pickBranches,
  RelatedBranch,
} from '@planner/domain/related-branches';
import { RepoCredentials } from './repo-remote';

/**
 * Clona, aparte y de solo lectura, las ramas del repo que llevan alguna de las claves de ticket que la tarea menciona
 * (`MEL-466` -> `feature/MEL-466/…`), en carpetas hermanas del repo: `<repo>@<clave>`. Así el agente puede leer con `Read` y
 * `Grep` lo que de esa rama depende la tarea, que no está en la rama principal.
 *
 * Nunca falla: sin red, sin la rama o con cualquier error el plan sigue con lo que ya tiene.
 */
export async function cloneRelatedBranches(options: {
  credentials: RepoCredentials;
  /** Carpeta que contiene a todos los repos. */
  parent: string;
  repoName: string;
  keys: readonly string[];
  warn: (message: string) => void;
}): Promise<RelatedBranch[]> {
  const { credentials, parent, repoName, keys, warn } = options;
  if (keys.length === 0) return [];

  try {
    const listing = await runGit(
      ['ls-remote', '--heads', credentials.cloneUrl],
      { secrets: [credentials.secret] },
    );
    const picked = pickBranches(headsOf(listing), keys);

    const cloned: RelatedBranch[] = [];
    for (const { key, branch } of picked) {
      const same = cloned.filter((known) => known.key === key).length;
      const folder = `${repoName}@${key}${same > 0 ? `-${same + 1}` : ''}`;
      const dest = join(parent, folder);
      try {
        await rm(dest, { recursive: true, force: true });
        await runGit(
          [
            'clone',
            '--quiet',
            '--depth',
            '1',
            '--branch',
            branch,
            credentials.cloneUrl,
            dest,
          ],
          { secrets: [credentials.secret] },
        );
        await runGit(['remote', 'set-url', 'origin', credentials.cleanUrl], {
          cwd: dest,
          secrets: [credentials.secret],
        });
        cloned.push({ key, branch, folder });
      } catch (error) {
        await rm(dest, { recursive: true, force: true }).catch(() => undefined);
        warn(
          `Could not clone the branch ${branch} of ${repoName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return cloned;
  } catch (error) {
    warn(
      `Could not look for the related branches of ${repoName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}
