import { mkdir, readdir, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ATTACHMENTS_DIR } from '@core/attachments/attachments';
import { runGit } from '@core/git/run-git';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';
import {
  CachedRepos,
  ReposCachePort,
} from '@planner/domain/ports/repos-cache.port';
import {
  ParsedRepo,
  REPO_BRANCHES,
  parseRepoUrl,
  repoCredentials,
  repoFolderName,
} from './repo-remote';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
const ISSUE_ID = /^[\w-]+$/;

/**
 * Mantiene los repos de cada tarea en `TASK_REPOS_DIR/<tarea>/<repo>`, superficiales y de solo lectura
 * (rama `main` o, si no existe, `master`). La primera vez clona; las siguientes solo trae lo nuevo de la
 * rama. Como en los demás clones, el token solo se usa para hablar con el proveedor y nunca queda en el
 * `.git/config` que el agente puede leer.
 */
@Injectable()
export class GitReposCacheAdapter implements ReposCachePort {
  private readonly logger = new Logger(GitReposCacheAdapter.name);
  private readonly running = new Map<string, Promise<CachedRepos>>();
  private lastSweep = 0;

  constructor(private readonly config: ConfigService) {}

  ensure(issueId: string, repoUrls: string[]): Promise<CachedRepos> {
    if (!ISSUE_ID.test(issueId)) {
      return Promise.reject(new Error(`Unsafe task id: ${issueId}`));
    }

    // Dos preguntas a la vez sobre la misma tarea comparten una sola actualización.
    const key = `${issueId}|${repoUrls.join(',')}`;
    const running = this.running.get(key);
    if (running) return running;

    const task = this.sync(issueId, repoUrls).finally(() => {
      this.running.delete(key);
    });
    this.running.set(key, task);
    return task;
  }

  private async sync(
    issueId: string,
    repoUrls: string[],
  ): Promise<CachedRepos> {
    const root = this.root();
    const base = join(root, issueId);
    await mkdir(base, { recursive: true });

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
      repos.push(await this.syncOne(url, parsed, join(base, name), name));
    }

    // Un repo que la tarea ya no tiene no debe quedar al alcance del agente.
    for (const entry of await readdir(base)) {
      // La carpeta de adjuntos no es un repo, pero tampoco se borra: la IA puede estar leyéndola.
      if (!folders.has(entry) && entry !== ATTACHMENTS_DIR) {
        await rm(join(base, entry), { recursive: true, force: true });
      }
    }

    // La fecha de la carpeta dice cuándo se usó por última vez; la limpieza se guía por ella.
    const now = new Date();
    await utimes(base, now, now);
    void this.sweep(root);

    return { path: base, repos };
  }

  private async syncOne(
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
    const git = (args: string[], cwd?: string) =>
      runGit(args, { cwd, secrets: [credentials.secret] });

    if (await this.isRepository(dest)) {
      for (const branch of REPO_BRANCHES) {
        if (!(await this.hasBranch(dest, branch))) continue;
        try {
          await git(
            [
              'fetch',
              '--quiet',
              '--depth',
              '1',
              credentials.cloneUrl,
              `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
            ],
            dest,
          );
          await git(
            ['checkout', '--quiet', '--detach', '--force', `origin/${branch}`],
            dest,
          );
          return { url, name, used: true, note: null };
        } catch (error) {
          // Sin red o sin acceso por un momento: se sigue con la copia anterior en vez de dejar al agente sin código.
          this.logger.warn(
            `Could not update ${parsed.organization}/${parsed.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return {
            url,
            name,
            used: true,
            note: 'no se pudo actualizar: se usa la copia anterior',
          };
        }
      }
      // La copia no tiene ninguna de las ramas esperadas: se descarta y se clona de nuevo.
      await rm(dest, { recursive: true, force: true });
    }

    for (const branch of REPO_BRANCHES) {
      try {
        await git([
          'clone',
          '--quiet',
          '--depth',
          '1',
          '--branch',
          branch,
          credentials.cloneUrl,
          dest,
        ]);
        await git(['remote', 'set-url', 'origin', credentials.cleanUrl], dest);
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

  private root(): string {
    return (
      this.config.get<string>('TASK_REPOS_DIR') ||
      join(tmpdir(), 'workbench-task-repos')
    );
  }

  private async isRepository(path: string): Promise<boolean> {
    try {
      return (await stat(join(path, '.git'))).isDirectory();
    } catch {
      return false;
    }
  }

  private async hasBranch(repoPath: string, branch: string): Promise<boolean> {
    try {
      await runGit(
        ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`],
        { cwd: repoPath },
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Borra las tareas que llevan días sin usarse. Como mucho una vez por hora; nunca falla. */
  private async sweep(root: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;

    try {
      for (const name of await readdir(root)) {
        const path = join(root, name);
        const { mtimeMs } = await stat(path);
        if (now - mtimeMs > MAX_AGE_MS) {
          await rm(path, { recursive: true, force: true });
          this.logger.log(`Removed unused task repositories ${name}`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not clean the task repositories: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
