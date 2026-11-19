import { mkdir, readdir, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ATTACHMENTS_DIR } from '@core/attachments/attachments';
import { type Mirror, RepoMirrorService } from '@core/git/repo-mirror';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';
import {
  CachedRepos,
  ReposCachePort,
  type ReposOptions,
} from '@planner/domain/ports/repos-cache.port';
import { addRelatedBranches } from './add-related-branches';
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
 * Deja a la vista de la tarea los repos que usa, en `TASK_REPOS_DIR/<tarea>/<repo>`: un worktree de solo lectura (rama `main` o, si
 * no existe, `master`) del mirror compartido del repo. El repo se clona una sola vez para todo el servidor; cada vez que se piden
 * solo se traen los cambios al mirror y el worktree se lleva a lo último de la rama.
 */
@Injectable()
export class GitReposCacheAdapter implements ReposCachePort {
  private readonly logger = new Logger(GitReposCacheAdapter.name);
  private readonly running = new Map<string, Promise<CachedRepos>>();
  private lastSweep = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly mirror: RepoMirrorService,
  ) {}

  ensure(
    issueId: string,
    repoUrls: string[],
    options: ReposOptions = {},
  ): Promise<CachedRepos> {
    if (!ISSUE_ID.test(issueId)) {
      return Promise.reject(new Error(`Unsafe task id: ${issueId}`));
    }

    // Dos preguntas a la vez sobre la misma tarea comparten una sola actualización.
    const relatedKeys = options.relatedKeys ?? [];
    const key = `${issueId}|${repoUrls.join(',')}|${relatedKeys.join(',')}`;
    const running = this.running.get(key);
    if (running) return running;

    const task = this.sync(issueId, repoUrls, relatedKeys).finally(() => {
      this.running.delete(key);
    });
    this.running.set(key, task);
    return task;
  }

  private async sync(
    issueId: string,
    repoUrls: string[],
    relatedKeys: readonly string[],
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
      const repo = await this.syncOne(
        url,
        parsed,
        join(base, name),
        name,
        relatedKeys,
      );
      repos.push(repo);
      // Las ramas relacionadas viven junto al repo y se conservan mientras la tarea siga mencionándolas.
      for (const branch of repo.branches ?? []) folders.add(branch.folder);
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

  /** Actualiza el repo y, si la tarea menciona otros tickets, deja a la vista sus ramas aparte. */
  private async syncOne(
    url: string,
    parsed: ParsedRepo,
    dest: string,
    name: string,
    keys: readonly string[],
  ): Promise<PlanRepoInfo> {
    const { repo, mirrorPath } = await this.syncMain(url, parsed, dest, name);
    if (!repo.used || !mirrorPath) return repo;

    const branches = await addRelatedBranches({
      mirror: this.mirror,
      mirrorPath,
      parent: dirname(dest),
      repoName: name,
      keys,
      warn: (message) => this.logger.warn(message),
    });
    return branches.length > 0 ? { ...repo, branches } : repo;
  }

  private async syncMain(
    url: string,
    parsed: ParsedRepo,
    dest: string,
    name: string,
  ): Promise<{ repo: PlanRepoInfo; mirrorPath?: string }> {
    const credentials = repoCredentials(this.config, parsed);
    if (!credentials) {
      return {
        repo: {
          url,
          name,
          used: false,
          note: `no hay token configurado para ${parsed.host}`,
        },
      };
    }

    let mirror: Mirror;
    try {
      mirror = await this.mirror.sync({
        key: `${parsed.host}/${parsed.organization}/${parsed.name}`,
        ...credentials,
      });
    } catch (error) {
      this.logger.warn(
        `Could not get ${parsed.organization}/${parsed.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        repo: {
          url,
          name,
          used: false,
          note: 'no se pudo clonar: no existe la rama main ni master, o no hay acceso',
        },
      };
    }

    let branch: string | undefined;
    for (const candidate of REPO_BRANCHES) {
      if (await this.mirror.hasBranch(mirror.path, candidate)) {
        branch = candidate;
        break;
      }
    }
    if (!branch) {
      return {
        repo: {
          url,
          name,
          used: false,
          note: 'no se pudo clonar: no existe la rama main ni master, o no hay acceso',
        },
      };
    }

    try {
      // Una carpeta que no es un worktree (un clon de antes) se reemplaza.
      if (await this.mirror.isWorktree(dest)) {
        await this.mirror.checkoutBranch(dest, branch);
      } else {
        await this.mirror.addWorktree(mirror.path, dest, branch);
      }
    } catch (error) {
      this.logger.warn(
        `Could not prepare ${parsed.organization}/${parsed.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        repo: {
          url,
          name,
          used: false,
          note: 'no se pudo preparar la copia del repositorio',
        },
      };
    }

    return {
      repo: {
        url,
        name,
        used: true,
        // Sin red o sin acceso por un momento: se sigue con la copia anterior en vez de dejar al agente sin código.
        note: mirror.fresh
          ? null
          : 'no se pudo actualizar: se usa la copia anterior',
      },
      mirrorPath: mirror.path,
    };
  }

  private root(): string {
    return (
      this.config.get<string>('TASK_REPOS_DIR') ||
      join(tmpdir(), 'workbench-task-repos')
    );
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
