import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Una carpeta de dependencias que se instala en el worktree (`vendor`, `node_modules`) y el archivo de versiones que la define. */
export interface DependencyCacheEntry {
  /** Relativa al worktree. */
  dir: string;
  /** Relativo al worktree (`composer.lock`): su hash dice con qué versiones se armó la copia. */
  lock: string;
}

type Run = (
  command: string,
  args: string[],
) => Promise<{ code: number; stderr: string }>;

const slug = (text: string) => text.replace(/[^A-Za-z0-9._-]/g, '_');

/**
 * Una copia de las dependencias de cada repo, para que un worktree nuevo no las instale desde cero. Es una copia y no un volumen o un
 * enlace porque los agentes leen `vendor/` desde el disco y el autoload de Composer calcula la raíz del proyecto desde su ruta real.
 * Con la copia puesta, `composer install` solo comprueba (o instala la diferencia si la rama cambió el lockfile).
 */
export class DependencyCache {
  constructor(
    private readonly root: string,
    private readonly run: Run,
  ) {}

  /** Pone la copia guardada en el worktree si todavía no tiene la carpeta. Devuelve si copió algo. */
  async seed(
    repo: string,
    worktree: string,
    entries: DependencyCacheEntry[],
  ): Promise<string[]> {
    const copied: string[] = [];
    for (const entry of entries) {
      const target = join(worktree, entry.dir);
      if (await hasFiles(target)) continue;
      const source = this.dataOf(repo, entry);
      if (!(await hasFiles(source))) continue;
      await mkdir(target, { recursive: true });
      const done = await this.run('cp', [
        '-a',
        '--reflink=auto',
        `${source}${'/.'}`,
        target,
      ]);
      if (done.code !== 0) {
        await rm(target, { recursive: true, force: true });
        continue;
      }
      copied.push(entry.dir);
    }
    return copied;
  }

  /**
   * Guarda lo que quedó instalado si la copia es de otro lockfile. `fromBase` dice si el lockfile de ese worktree es el de la rama
   * base: así la copia siempre tiene las dependencias típicas y una tarea que cambia una versión no la cambia para las demás.
   * Devuelve qué carpetas actualizó.
   */
  async save(
    repo: string,
    worktree: string,
    entries: DependencyCacheEntry[],
    fromBase: (entry: DependencyCacheEntry) => Promise<boolean> = async () =>
      true,
  ): Promise<string[]> {
    const saved: string[] = [];
    for (const entry of entries) {
      if (!(await fromBase(entry))) continue;
      const source = join(worktree, entry.dir);
      const lockHash = await hashOf(join(worktree, entry.lock));
      if (!lockHash || !(await hasFiles(source))) continue;
      const base = this.baseOf(repo, entry);
      if ((await readText(join(base, 'lock.sha'))) === lockHash) continue;

      const fresh = join(base, `data.tmp-${process.pid}`);
      await rm(fresh, { recursive: true, force: true });
      await mkdir(fresh, { recursive: true });
      const done = await this.run('cp', [
        '-a',
        '--reflink=auto',
        `${source}/.`,
        fresh,
      ]);
      if (done.code !== 0) {
        await rm(fresh, { recursive: true, force: true });
        continue;
      }
      await rm(this.dataOf(repo, entry), { recursive: true, force: true });
      await rename(fresh, this.dataOf(repo, entry));
      await writeFile(join(base, 'lock.sha'), lockHash);
      saved.push(entry.dir);
    }
    return saved;
  }

  private baseOf(repo: string, entry: DependencyCacheEntry): string {
    return join(this.root, slug(repo), slug(entry.dir));
  }

  private dataOf(repo: string, entry: DependencyCacheEntry): string {
    return join(this.baseOf(repo, entry), 'data');
  }
}

async function hasFiles(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return false;
  return (await readdir(dir).catch(() => [])).length > 0;
}

async function hashOf(file: string): Promise<string | null> {
  if (!existsSync(file)) return null;
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}

async function readText(file: string): Promise<string | null> {
  return readFile(file, 'utf8').then(
    (text) => text.trim(),
    () => null,
  );
}
