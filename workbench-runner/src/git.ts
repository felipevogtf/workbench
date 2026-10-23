import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

/** SSH sin preguntar nada: si falta una llave o un permiso, falla en vez de quedarse esperando. */
const SSH_COMMAND = 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new';

/** Ejecuta `git` sin shell y sin pedir credenciales. Devuelve stdout; rechaza si falla o pasa el tiempo. */
export function git(
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || SSH_COMMAND,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`git ${args[0]} tardó demasiado y se canceló`));
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new Error(
          error.code === 'ENOENT'
            ? 'git no está instalado o no está en el PATH'
            : `No se pudo ejecutar git: ${error.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      reject(
        new Error(`git ${args[0]} falló: ${stderr.trim() || stdout.trim()}`),
      );
    });
  });
}
