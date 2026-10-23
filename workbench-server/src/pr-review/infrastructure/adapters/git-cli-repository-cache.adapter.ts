import { mkdir, readdir, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runGit } from '@core/git/run-git';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  CachedRepository,
  RepositoryCachePort,
} from '@pr-review/domain/ports/repository-cache.port';
import { assertSafeRemote, remoteUrls } from './git-remote';

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
 * Mantiene un clon por PR en `CHAT_REPOS_DIR`. La primera vez clona; las siguientes solo traen las
 * ramas de la PR. Como en el checkout de las revisiones, el token solo se usa para hablar con el
 * proveedor y nunca queda en el `.git/config` que el agente puede leer.
 */
@Injectable()
export class GitCliRepositoryCacheAdapter implements RepositoryCachePort {
  private readonly logger = new Logger(GitCliRepositoryCacheAdapter.name);
  private readonly running = new Map<string, Promise<CachedRepository>>();
  private lastSweep = 0;

  constructor(private readonly config: ConfigService) {}

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
    const { cloneUrl, cleanUrl, secret } = remoteUrls(this.config, pullRequest);
    const git = (args: string[], cwd?: string) =>
      runGit(args, { cwd, secrets: [secret] });

    await mkdir(root, { recursive: true });

    if (await this.isRepository(dest)) {
      const { sourceBranch: source, destBranch: target } = pullRequest;
      await git(
        [
          'fetch',
          '--quiet',
          cloneUrl,
          `+refs/heads/${source}:refs/remotes/origin/${source}`,
          `+refs/heads/${target}:refs/remotes/origin/${target}`,
        ],
        dest,
      );
    } else {
      // Un clon a medias de un intento anterior se descarta.
      await rm(dest, { recursive: true, force: true });
      try {
        await git(['clone', '--quiet', '--no-checkout', cloneUrl, dest]);
        await git(['remote', 'set-url', 'origin', cleanUrl], dest);
      } catch (error) {
        await rm(dest, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
    }

    await git(
      [
        'checkout',
        '--quiet',
        '--detach',
        '--force',
        `origin/${pullRequest.sourceBranch}`,
      ],
      dest,
    );
    const commit = (await git(['rev-parse', 'HEAD'], dest)).trim();

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

  private async isRepository(path: string): Promise<boolean> {
    try {
      return (await stat(join(path, '.git'))).isDirectory();
    } catch {
      return false;
    }
  }

  /** Borra los clones que llevan días sin usarse. Como mucho una vez por hora; nunca falla. */
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
