import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runGit } from '@core/git/run-git';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';
import {
  ReposCheckout,
  ReposCheckoutPort,
  ReposOptions,
} from '@planner/domain/ports/repos-checkout.port';
import { cloneRelatedBranches } from './clone-related-branches';
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
  private readonly logger = new Logger(GitReposCheckoutAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async checkout(
    repoUrls: string[],
    options: ReposOptions = {},
  ): Promise<ReposCheckout> {
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
        repos.push(
          await this.cloneOne(
            url,
            parsed,
            join(workdir, name),
            name,
            options.relatedKeys ?? [],
          ),
        );
      }

      return { path: workdir, repos, dispose };
    } catch (error) {
      await dispose().catch(() => undefined);
      throw error;
    }
  }

  /** Clona el repo y, si la tarea menciona otros tickets, sus ramas aparte. */
  private async cloneOne(
    url: string,
    parsed: ParsedRepo,
    dest: string,
    name: string,
    keys: readonly string[],
  ): Promise<PlanRepoInfo> {
    const repo = await this.cloneMain(url, parsed, dest, name);
    const credentials = repo.used ? repoCredentials(this.config, parsed) : null;
    if (!credentials) return repo;

    const branches = await cloneRelatedBranches({
      credentials,
      parent: dirname(dest),
      repoName: name,
      keys,
      warn: (message) => this.logger.warn(message),
    });
    return branches.length > 0 ? { ...repo, branches } : repo;
  }

  private async cloneMain(
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
