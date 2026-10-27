import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { git } from './git';

/**
 * Una carpeta dentro del worktree para los archivos de prueba del agente (una imagen para probar una subida con `curl`, por
 * ejemplo). Git la ignora, así que nunca llega a un commit, y se borra al terminar el trabajo: el agente no necesita `rm` ni
 * deja archivos sueltos en el repositorio.
 */
export const SCRATCH_DIR = '.wb-scratch';

/** Deja la carpeta fuera de git (en `info/exclude` del worktree, que no se versiona). */
export function ignoreScratch(dir: string): Promise<void> {
  return ignorePath(dir, `/${SCRATCH_DIR}/`);
}

/** Agrega una línea a `info/exclude` del worktree si no está. */
export async function ignorePath(dir: string, line: string): Promise<void> {
  const exclude = (
    await git(['rev-parse', '--git-path', 'info/exclude'], { cwd: dir })
  ).trim();
  const path = resolve(dir, exclude);
  await mkdir(dirname(path), { recursive: true });
  const current = existsSync(path) ? await readFile(path, 'utf8') : '';
  if (current.split('\n').includes(line)) return;
  await appendFile(
    path,
    `${current.endsWith('\n') || !current ? '' : '\n'}${line}\n`,
  );
}

export function clearScratch(dir: string): Promise<void> {
  return rm(join(dir, SCRATCH_DIR), { recursive: true, force: true });
}
