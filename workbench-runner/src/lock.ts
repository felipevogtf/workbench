import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOCK_FILE = 'runner.lock';

export type LockResult =
  { ok: true; release(): void } | { ok: false; busyPid: number };

function isAlive(pid: number): boolean {
  try {
    // La señal 0 no hace nada: solo comprueba que el proceso exista.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: existe, pero es de otro usuario.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** El PID que guarda el archivo, o `null` si no hay archivo o no es legible. */
function holder(path: string): number | null {
  if (!existsSync(path)) return null;
  const pid = Number(readFileSync(path, 'utf8').trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/**
 * Asegura que solo haya un runner por carpeta de trabajo: así el enlace `workbench-runner://` y el
 * arranque con Windows pueden lanzarlo cuando quieran sin que se dupliquen. Devuelve `null` (y el PID
 * del que ya corre) si ya hay otro vivo; el archivo de un runner que murió se ignora.
 */
export function acquireLock(
  dir: string,
  pid: number = process.pid,
): LockResult {
  const path = join(dir, LOCK_FILE);

  const other = holder(path);
  if (other !== null && other !== pid && isAlive(other)) {
    return { ok: false, busyPid: other };
  }

  writeFileSync(path, String(pid));
  return {
    ok: true,
    release() {
      // Solo se borra lo propio: no el archivo de otro runner que haya tomado el lugar.
      if (holder(path) === pid) rmSync(path, { force: true });
    },
  };
}
