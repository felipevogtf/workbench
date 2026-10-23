import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runGit } from '@core/git/run-git';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';
import {
  ReposCheckout,
  ReposCheckoutPort,
} from '@planner/domain/ports/repos-checkout.port';
import {
  ParsedRepo,
  REPO_BRANCHES,
  parseRepoUrl,
  repoCredentials,
  repoFolderName,
} from './repo-remote';

/**
 * Clona repositorios en un directorio temporal, superficialmente y de solo lectura: rama `main` o,
 * si no existe, `master`. El token solo se usa durante el clone: el remoto queda sin credenciales
 * para que el agente no pueda leerlas desde `.git/config`.
 */
@Injectable()
export class GitReposCheckoutAdapter implements ReposCheckoutPort {
  constructor(private readonly config: ConfigService) {}

  async checkout(repoUrls: string[]): Promise<ReposCheckout> {
    const workdir = await mkdtemp(join(tmpdir(), 'plan-'));
    const dispose = () => rm(workdir, { recursive: true, force: true });

    try {
      const repos: PlanRepoInfo[] = [];
      const folders = new Set<string>();

      for (const url of repoUrls) {
        const parsed = parseRepoUrl(url);
        if (!parsed) {
          repos.push({
            url,
            name: '',
            used: false,
            note: 'enlace de repositorio no válido',
          });
          continue;
        }

        const name = repoFolderName(parsed, folders);
        folders.add(name);
        repos.push(await this.cloneOne(url, parsed, join(workdir, name), name));
      }

      return { path: workdir, repos, dispose };
    } catch (error) {
      await dispose().catch(() => undefined);
      throw error;
    }
  }

  private async cloneOne(
    url: string,
    parsed: ParsedRepo,
    dest: string,
    name: string,
  ): Promise<PlanRepoInfo> {
    const credentials = repoCredentials(this.config, parsed);
    if (!credentials) {
      return {
        url,
        name,
        used: false,
        note: `no hay token configurado para ${parsed.host}`,
      };
    }

    for (const branch of REPO_BRANCHES) {
      try {
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
        return { url, name, used: true, note: null };
      } catch {
        // Esa rama no existe (o no hay acceso): se prueba la siguiente.
        await rm(dest, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    return {
      url,
      name,
      used: false,
      note: 'no se pudo clonar: no existe la rama main ni master, o no hay acceso',
    };
  }
}
