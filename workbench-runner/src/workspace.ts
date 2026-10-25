import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { git } from './git';

const SSH_URL = /^git@(bitbucket\.org|github\.com):[\w.-]+\/[\w.-]+\.git$/;
const FULL_NAME = /^\w[\w.-]*\/\w[\w.-]*$/;
const BRANCH = /^[\w][\w./-]*$/;

/** Los worktrees sin tocar por más de esto se borran al arrancar. */
const WORKTREE_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

export interface Workspace {
  /** Carpeta del worktree: donde trabaja el agente. */
  dir: string;
  /** Rama a la que apunta la PR (la principal del repo). */
  baseBranch: string;
}

/**
 * Lo que llega del servidor termina en rutas y argumentos de git: se valida antes de usarlo para que
 * un nombre de repo o de rama no pueda salirse de la carpeta de trabajo ni inyectar opciones.
 */
export function assertSafe(
  repo: { sshUrl: string; fullName: string },
  branch: string,
  checkUrl = true,
): void {
  if (
    !FULL_NAME.test(repo.fullName) ||
    repo.fullName.split('/').some((part) => /^\.+$/.test(part))
  ) {
    throw new Error(`Nombre de repositorio no permitido: ${repo.fullName}`);
  }
  if (checkUrl && !SSH_URL.test(repo.sshUrl)) {
    throw new Error(`Dirección del repositorio no permitida: ${repo.sshUrl}`);
  }
  if (!BRANCH.test(branch) || branch.includes('..') || branch.endsWith('/')) {
    throw new Error(`Nombre de rama no permitido: ${branch}`);
  }
}

/** Repos clonados y una rama de trabajo (worktree) por ejecución, todo dentro de `workDir`. */
export class Workspaces {
  constructor(
    private readonly workDir: string,
    private readonly overrides: Record<string, string> = {},
    private readonly copyFiles: Record<
      string,
      { from: string; to: string }[]
    > = {},
  ) {}

  /** Deja listo el worktree de la rama de la ejecución: la primera vez la crea y después la reutiliza. */
  async prepare(
    repo: { sshUrl: string; fullName: string },
    branch: string,
  ): Promise<Workspace> {
    // Un repo con otra dirección configurada (espejo local) no usa la que manda el servidor.
    const url = this.overrides[repo.fullName];
    assertSafe(repo, branch, !url);

    const clone = this.inside('repos', repo.fullName.replace('/', '__'));
    await mkdir(resolve(clone, '..'), { recursive: true });

    if (existsSync(join(clone, '.git'))) {
      await git(['fetch', '--prune', 'origin'], { cwd: clone });
    } else {
      await git(['clone', '--no-tags', url ?? repo.sshUrl, clone]);
    }

    const baseBranch = await this.defaultBranch(clone);
    const dir = this.inside('worktrees', branch.replaceAll('/', '__'));

    if (!existsSync(dir)) {
      await mkdir(resolve(dir, '..'), { recursive: true });
      const exists = await git(
        ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
        {
          cwd: clone,
        },
      ).then(
        () => true,
        () => false,
      );
      await git(
        exists
          ? ['worktree', 'add', dir, branch]
          : [
              'worktree',
              'add',
              '--no-track',
              '-b',
              branch,
              dir,
              `origin/${baseBranch}`,
            ],
        { cwd: clone },
      );
      await this.setUp(repo.fullName, dir);
    }
    return { dir, baseBranch };
  }

  /**
   * Lo que un worktree nuevo necesita para poder compilar: los submódulos (git no los trae solo) y los
   * archivos que el repo no versiona y se configuran en `copyFiles`.
   */
  private async setUp(fullName: string, dir: string): Promise<void> {
    if (existsSync(join(dir, '.gitmodules'))) {
      await git(['submodule', 'update', '--init', '--recursive'], { cwd: dir });
    }
    for (const file of this.copyFiles[fullName] ?? []) {
      const from = this.insideDir(dir, file.from);
      if (!existsSync(from)) continue;
      const to = this.insideDir(dir, file.to);
      if (existsSync(to)) continue;
      await mkdir(dirname(to), { recursive: true });
      await copyFile(from, to);
    }
  }

  /** Sube la rama al remoto (por SSH, con las llaves de este PC). */
  async push(dir: string, branch: string): Promise<void> {
    await git(['push', '--set-upstream', 'origin', branch], { cwd: dir });
  }

  /** Quita el worktree de una rama ya publicada; la rama y el clon se conservan. */
  async release(repo: { fullName: string }, branch: string): Promise<void> {
    const clone = this.inside('repos', repo.fullName.replace('/', '__'));
    const dir = this.inside('worktrees', branch.replaceAll('/', '__'));
    await git(['worktree', 'remove', '--force', dir], { cwd: clone }).catch(
      () => undefined,
    );
  }

  /** Borra los worktrees abandonados (ejecuciones canceladas o que fallaron y nadie retomó). */
  async sweep(now = Date.now()): Promise<string[]> {
    const root = this.inside('worktrees');
    if (!existsSync(root)) return [];

    const removed: string[] = [];
    for (const name of await readdir(root)) {
      const path = join(root, name);
      const info = await stat(path).catch(() => null);
      if (info && now - info.mtimeMs > WORKTREE_MAX_AGE_MS) {
        await rm(path, { recursive: true, force: true });
        removed.push(name);
      }
    }
    // Lo que quedó apuntando a carpetas borradas se limpia en cada clon.
    for (const name of existsSync(this.inside('repos'))
      ? await readdir(this.inside('repos'))
      : []) {
      await git(['worktree', 'prune'], {
        cwd: this.inside('repos', name),
      }).catch(() => undefined);
    }
    return removed;
  }

  private async defaultBranch(clone: string): Promise<string> {
    const head = await git(
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      {
        cwd: clone,
      },
    ).catch(() => '');
    const name = head.trim().replace(/^origin\//, '');
    if (name) return name;

    // Los clones sin `origin/HEAD` (remotos recién creados) se resuelven preguntándole al remoto.
    await git(['remote', 'set-head', 'origin', '--auto'], { cwd: clone }).catch(
      () => undefined,
    );
    const retry = await git(
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      {
        cwd: clone,
      },
    ).catch(() => '');
    const resolved = retry.trim().replace(/^origin\//, '');
    if (!resolved)
      throw new Error(
        'No se pudo saber cuál es la rama principal del repositorio',
      );
    return resolved;
  }

  /** Una ruta relativa dentro de un worktree; nunca fuera de él. */
  private insideDir(dir: string, relative: string): string {
    const path = resolve(dir, relative);
    if (isAbsolute(relative) || !path.startsWith(dir + sep)) {
      throw new Error(`Ruta fuera del repositorio: ${relative}`);
    }
    return path;
  }

  /** Una ruta dentro de `workDir`; nunca fuera de ella. */
  private inside(...parts: string[]): string {
    const root = resolve(this.workDir);
    const path = resolve(root, ...parts);
    if (path !== root && !path.startsWith(root + sep)) {
      throw new Error(`Ruta fuera de la carpeta de trabajo: ${path}`);
    }
    return path;
  }
}
