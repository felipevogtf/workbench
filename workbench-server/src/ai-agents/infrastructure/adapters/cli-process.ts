import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

export interface CliRun {
  /** Nombre legible del CLI, para los mensajes de error. */
  label: string;
  bin: string;
  args: string[];
  cwd: string;
  /** Si se indica, se envía por stdin; si no, el CLI recibe el prompt por argumentos. */
  stdin?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  /** Oculta credenciales antes de mostrar la salida de un error. */
  sanitize: (text: string) => string;
  /** Cómo avisar que el binario no existe (ej. qué variable configurar). */
  notFoundHint: string;
}

/** Ejecuta un CLI de IA y devuelve su salida. Rechaza por timeout, código distinto de 0 o salida vacía. */
export function runCli(run: CliRun): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(run.bin, run.args, {
      cwd: run.cwd,
      env: run.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() =>
        reject(new Error(`Agent timed out after ${run.timeoutMs} ms`)),
      );
    }, run.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk;
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      const message =
        err.code === 'ENOENT'
          ? `${run.label} not found ("${run.bin}"). ${run.notFoundHint}`
          : `Could not start ${run.label}: ${err.message}`;
      finish(() => reject(new Error(message)));
    });

    child.on('close', (code) => {
      finish(() => {
        if (code !== 0) {
          reject(
            new Error(
              `${run.label} failed (exit ${code}): ${run.sanitize(stderr || stdout).slice(0, 2000)}`,
            ),
          );
          return;
        }
        const output = stdout.trim();
        if (!output) {
          reject(new Error(`${run.label} returned an empty response`));
          return;
        }
        resolve(output);
      });
    });

    child.stdin.on('error', () => undefined);
    child.stdin.end(run.stdin ?? '');
  });
}
