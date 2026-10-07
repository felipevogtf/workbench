import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface RunGitOptions {
  cwd?: string;
  /** Credenciales que pudieron colarse en la salida de un error: se ocultan antes de mostrarla. */
  secrets?: string[];
  timeoutMs?: number;
}

/**
 * Ejecuta `git` sin shell y sin pedir credenciales por terminal. Devuelve stdout; rechaza si falla
 * (con el error de git ya sin credenciales) o si pasa el tiempo límite.
 */
export function runGit(
  args: string[],
  options: RunGitOptions = {},
): Promise<string> {
  const secrets = (options.secrets ?? []).filter(Boolean);

  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: options.cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`git ${args[0]} timed out`));
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new Error(
          err.code === 'ENOENT'
            ? 'git is not installed'
            : `Could not run git: ${err.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      let clean = stderr;
      for (const secret of secrets) {
        clean = clean
          .split(secret)
          .join('***')
          .split(encodeURIComponent(secret))
          .join('***');
      }
      reject(new Error(`git ${args[0]} failed: ${clean.trim()}`));
    });
  });
}
