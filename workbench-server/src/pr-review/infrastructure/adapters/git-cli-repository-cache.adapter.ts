import { mkdir, readdir, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepoMirrorService } from '@core/git/repo-mirror';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  CachedRepository,
  RepositoryCachePort,
} from '@pr-review/domain/ports/repository-cache.port';
import { assertSafeRemote, mirrorRemote } from './git-remote';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;

/** Una carpeta por PR: así dos PRs del mismo repo no se pisan la rama en checkout. */
export function cacheKey(pullRequest: PullRequest): string {
  const safe = (text: string) => text.replace(/[^\w.-]/g, '_');
  return [
    pullRequest.provider,
    safe(pullRequest.repo.replace('/', '__')),
    safe(pullRequest.externalId),
  ].join('__');
}

/**
 * Deja a la vista el repo de una PR en `CHAT_REPOS_DIR/<PR>`: un worktree de su rama, sacado del mirror compartido del repo (el
 * mismo que usa el planificador). El repo se clona una sola vez para todo el servidor; cada vez que se pide solo se traen los cambios
 * y el worktree se lleva al último commit de la rama de la PR.
 */
@Injectable()
export class GitCliRepositoryCacheAdapter implements RepositoryCachePort {
  private readonly logger = new Logger(GitCliRepositoryCacheAdapter.name);
  private readonly running = new Map<string, Promise<CachedRepository>>();
  private lastSweep = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly mirror: RepoMirrorService,
  ) {}

  ensure(pullRequest: PullRequest): Promise<CachedRepository> {
    assertSafeRemote(pullRequest);

    // Dos preguntas a la vez sobre la misma PR comparten una sola actualización.
    const key = cacheKey(pullRequest);
    const running = this.running.get(key);
    if (running) return running;

    const task = this.sync(pullRequest, key).finally(() => {
      this.running.delete(key);
    });
    this.running.set(key, task);
    return task;
  }

  private async sync(
    pullRequest: PullRequest,
    key: string,
  ): Promise<CachedRepository> {
    const root = this.root();
    const dest = join(root, key);
    const source = pullRequest.sourceBranch;

    await mkdir(root, { recursive: true });
    // Si no se puede traer lo último se sigue con lo que hay, siempre que la rama de la PR esté.
    const mirror = await this.mirror.sync(
      mirrorRemote(this.config, pullRequest),
    );
    if (!(await this.mirror.hasBranch(mirror.path, source))) {
      throw new Error(`The branch ${source} is not in the repository`);
    }

    // Una carpeta que no es un worktree de este mirror (un clon de antes, o el de otro host) se reemplaza.
    if (await this.mirror.isWorktreeOf(dest, mirror.path)) {
      await this.mirror.checkoutBranch(dest, source);
    } else {
      await this.mirror.addWorktree(mirror.path, dest, source);
    }
    const commit = await this.mirror.head(dest);

    // La fecha de la carpeta dice cuándo se usó por última vez; la limpieza se guía por ella.
    const now = new Date();
    await utimes(dest, now, now);
    void this.sweep(root);

    return { path: dest, commit };
  }

  private root(): string {
    return (
      this.config.get<string>('CHAT_REPOS_DIR') ||
      join(tmpdir(), 'workbench-chat-repos')
    );
  }

  /** Borra las copias que llevan días sin usarse. Como mucho una vez por hora; nunca falla. */
  private async sweep(root: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;

    try {
      for (const name of await readdir(root)) {
        if (this.running.has(name)) continue;
        const path = join(root, name);
        const { mtimeMs } = await stat(path);
        if (now - mtimeMs > MAX_AGE_MS) {
          await rm(path, { recursive: true, force: true });
          this.logger.log(`Removed unused repository copy ${name}`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not clean the repository copies: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
