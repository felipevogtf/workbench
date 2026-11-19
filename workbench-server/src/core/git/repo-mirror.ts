import {
  mkdir,
  readdir,
  realpath,
  rm,
  rmdir,
  stat,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runGit } from './run-git';

/** Un mirror que nadie pide en tanto tiempo se borra: el repo ya no se usa. */
const MIRROR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;
/** Traer todo el repositorio la primera vez puede tardar más que cualquier otro comando de git. */
const FETCH_TIMEOUT_MS = 15 * 60 * 1000;
const SEGMENT = /^[\w.-]+$/;
const FETCH_SPEC = '+refs/heads/*:refs/remotes/origin/*';

/** De dónde se trae un repositorio. */
export interface MirrorRemote {
  /** `host/organización/repo` (por ejemplo `github.com/acme/web`): identifica el mirror, sin importar las mayúsculas. */
  key: string;
  /** URL con el token, solo para traer cambios: nunca se guarda en el repo. */
  cloneUrl: string;
  /** URL sin credenciales: la que queda como `origin`. */
  cleanUrl: string;
  secret: string;
}

export interface Mirror {
  path: string;
  /** `false`: no se pudo traer lo último (sin red o sin acceso) y se sigue con la copia que ya había. */
  fresh: boolean;
}

/**
 * Un clon completo y sin carpeta de trabajo («bare») de cada repositorio, compartido por todo el servidor: se clona la primera vez
 * y después solo se traen los cambios. Quien necesita ver una rama (el chat de una tarea, el de una PR, una revisión) lo hace en su
 * propio worktree desprendido, que comparte los objetos del mirror: es instantáneo, no copia el repositorio y dos usos a la vez
 * nunca se pisan la rama en checkout.
 *
 * Las ramas del remoto quedan en `refs/remotes/origin/*`. Igual que en los demás clones, el token solo se usa para hablar con el
 * proveedor y nunca queda en la configuración del repo, que el agente puede leer.
 */
@Injectable()
export class RepoMirrorService {
  private readonly logger = new Logger(RepoMirrorService.name);
  private readonly queues = new Map<string, Promise<unknown>>();
  private lastSweep = 0;

  constructor(private readonly config: ConfigService) {}

  /**
   * Deja el mirror al día: lo clona la primera vez y después trae lo nuevo. Con `requireFresh` una actualización fallida es un
   * error (una revisión no debe mirar código viejo); sin él se sigue con la copia anterior.
   */
  sync(
    remote: MirrorRemote,
    options: { requireFresh?: boolean } = {},
  ): Promise<Mirror> {
    const path = this.pathOf(remote.key);
    return this.exclusive(path, async () => {
      const git = (args: string[], cwd?: string) =>
        runGit(args, {
          cwd,
          secrets: [remote.secret],
          timeoutMs: FETCH_TIMEOUT_MS,
        });
      const fetch = () =>
        git(['fetch', '--quiet', '--prune', remote.cloneUrl, FETCH_SPEC], path);

      let fresh = true;
      if (await this.exists(path)) {
        try {
          // Si el enlace del proyecto cambió, el `origin` del mirror lo sigue (solo informa: el fetch usa la URL que se le pasa).
          await git(['config', 'remote.origin.url', remote.cleanUrl], path);
          await fetch();
          // Los worktrees cuya carpeta ya se borró dejan de ocupar un lugar en el mirror.
          await git(['worktree', 'prune'], path);
        } catch (error) {
          if (options.requireFresh) throw error;
          fresh = false;
          this.logger.warn(
            `Could not update the mirror of ${remote.key}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        await mkdir(dirname(path), { recursive: true });
        try {
          await git(['init', '--quiet', '--bare', path]);
          await git(['config', 'remote.origin.url', remote.cleanUrl], path);
          await git(['config', 'remote.origin.fetch', FETCH_SPEC], path);
          await fetch();
        } catch (error) {
          // Un clon a medias no sirve: se descarta para que el próximo intento parta limpio.
          await rm(path, { recursive: true, force: true }).catch(
            () => undefined,
          );
          throw error;
        }
      }

      // La fecha del mirror dice cuándo se usó por última vez; la limpieza se guía por ella.
      const now = new Date();
      await utimes(path, now, now).catch(() => undefined);
      void this.sweep();
      return { path, fresh };
    });
  }

  /** Las ramas del remoto que el mirror conoce. */
  async branches(mirrorPath: string): Promise<string[]> {
    const listing = await runGit(
      ['for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin'],
      { cwd: mirrorPath },
    );
    return listing.split(/\r?\n/).filter(Boolean);
  }

  async hasBranch(mirrorPath: string, branch: string): Promise<boolean> {
    try {
      await runGit(['rev-parse', '--verify', '--quiet', branchRef(branch)], {
        cwd: mirrorPath,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Crea `dest` como un worktree desprendido en esa rama (lo que hubiera en `dest` se borra). El nombre de la rama puede venir de
   * afuera: no puede empezar con guion, porque acabaría como opción de git.
   */
  async addWorktree(
    mirrorPath: string,
    dest: string,
    branch: string,
  ): Promise<void> {
    assertSafeBranch(branch);
    await this.exclusive(mirrorPath, async () => {
      await rm(dest, { recursive: true, force: true });
      await mkdir(dirname(dest), { recursive: true });
      await runGit(['worktree', 'prune'], { cwd: mirrorPath });
      await runGit(
        ['worktree', 'add', '--quiet', '--detach', dest, branchRef(branch)],
        { cwd: mirrorPath },
      );
    });
  }

  /** Lleva un worktree que ya existe a esa rama, descartando lo que hubiera cambiado en él. */
  async checkoutBranch(worktree: string, branch: string): Promise<void> {
    assertSafeBranch(branch);
    await runGit(
      ['checkout', '--quiet', '--detach', '--force', branchRef(branch)],
      { cwd: worktree },
    );
  }

  /** Es una carpeta creada por `addWorktree` (y no, por ejemplo, un clon de antes). */
  async isWorktree(path: string): Promise<boolean> {
    try {
      return (await stat(join(path, '.git'))).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Es un worktree de ESTE mirror. Si el enlace de un proyecto cambió de host, el repo pasa a otro mirror y un worktree que
   * quedó del anterior mostraría código que nadie actualiza.
   */
  async isWorktreeOf(path: string, mirrorPath: string): Promise<boolean> {
    if (!(await this.isWorktree(path))) return false;
    try {
      const common = (
        await runGit(
          ['rev-parse', '--path-format=absolute', '--git-common-dir'],
          {
            cwd: path,
          },
        )
      ).trim();
      return (await realpath(common)) === (await realpath(mirrorPath));
    } catch {
      return false;
    }
  }

  /** El commit en que está el worktree. */
  async head(worktree: string): Promise<string> {
    return (await runGit(['rev-parse', 'HEAD'], { cwd: worktree })).trim();
  }

  /** Quita el worktree y su carpeta. Nunca falla: es limpieza. */
  removeWorktree(mirrorPath: string, dest: string): Promise<void> {
    return this.exclusive(mirrorPath, async () => {
      await runGit(['worktree', 'remove', '--force', dest], {
        cwd: mirrorPath,
      }).catch(() => undefined);
      await rm(dest, { recursive: true, force: true }).catch(() => undefined);
      await runGit(['worktree', 'prune'], { cwd: mirrorPath }).catch(
        () => undefined,
      );
    });
  }

  /**
   * Borra el mirror de un repositorio que ya no se usa (por ejemplo, porque el proyecto pasó a otro enlace). Los worktrees que
   * salieron de él quedan huérfanos y se rehacen la próxima vez que alguien los pida.
   */
  discard(key: string): Promise<void> {
    const path = this.pathOf(key);
    return this.exclusive(path, async () => {
      await rm(path, { recursive: true, force: true });
      this.logger.log(`Removed the mirror of ${key}`);
    });
  }

  /** Dónde vive el mirror de este repositorio. */
  pathOf(key: string): string {
    const segments = key.toLowerCase().split('/');
    if (
      segments.length !== 3 ||
      !segments.every(
        (segment) =>
          SEGMENT.test(segment) &&
          !segment.startsWith('-') &&
          !/^\.+$/.test(segment),
      )
    ) {
      throw new Error(`Unsafe repository key: ${key}`);
    }
    return `${join(this.root(), ...segments)}.git`;
  }

  private root(): string {
    return (
      this.config.get<string>('MIRRORS_DIR') ||
      join(tmpdir(), 'workbench-mirrors')
    );
  }

  private async exists(path: string): Promise<boolean> {
    try {
      return (await stat(join(path, 'HEAD'))).isFile();
    } catch {
      return false;
    }
  }

  /** Las operaciones sobre un mismo mirror van de una en una: dos `fetch` o un `worktree add` a la vez se pisarían. */
  private async exclusive<T>(path: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(path) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    this.queues.set(path, run);
    try {
      return await run;
    } finally {
      if (this.queues.get(path) === run) this.queues.delete(path);
    }
  }

  /** Borra los mirrors que llevan semanas sin usarse. Como mucho una vez por hora; nunca falla. */
  private async sweep(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;

    try {
      const root = this.root();
      for (const host of await readdir(root)) {
        for (const organization of await readdir(join(root, host))) {
          const folder = join(root, host, organization);
          for (const name of await readdir(folder)) {
            const path = join(folder, name);
            const { mtimeMs } = await stat(path);
            if (now - mtimeMs > MIRROR_MAX_AGE_MS && !this.queues.has(path)) {
              await rm(path, { recursive: true, force: true });
              this.logger.log(
                `Removed unused mirror ${host}/${organization}/${name}`,
              );
            }
          }
          // Una organización sin repos ya no hace falta.
          await rmdir(folder).catch(() => undefined);
        }
        await rmdir(join(root, host)).catch(() => undefined);
      }
    } catch (error) {
      this.logger.warn(
        `Could not clean the mirrors: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function branchRef(branch: string): string {
  return `refs/remotes/origin/${branch}`;
}

function assertSafeBranch(branch: string): void {
  const hasControlChar = [...branch].some((c) => c.charCodeAt(0) < 32);
  if (
    !branch ||
    branch.startsWith('-') ||
    /\s/.test(branch) ||
    hasControlChar
  ) {
    throw new Error(`Unsafe branch name: ${branch}`);
  }
}
