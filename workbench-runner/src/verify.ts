import { defaultExec, type Exec } from './environment';

/** Tiempo máximo de una verificación antes de publicar. */
export const VERIFY_TIMEOUT_MS = 10 * 60_000;
/** Cuánto de la salida se conserva en el mensaje de error: lo útil está al final. */
const TAIL_CHARS = 3_000;

export interface VerifyOutcome {
  ok: boolean;
  /** El final de lo que imprimió, para decir por qué falló. */
  output: string;
}

/**
 * Corre la verificación de un proyecto (un programa con sus argumentos, sin shell) en su carpeta de trabajo. Los comandos salen
 * de la configuración local del runner, nunca del servidor: el servidor solo dice cuál nombre aplica.
 */
export async function runVerification(
  argv: readonly string[],
  options: {
    cwd: string;
    env?: Record<string, string>;
    signal?: AbortSignal;
    onLine?: (line: string) => void;
    exec?: Exec;
    timeoutMs?: number;
  },
): Promise<VerifyOutcome> {
  const [command, ...args] = argv;
  const exec = options.exec ?? defaultExec;
  const result = await exec(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    timeoutMs: options.timeoutMs ?? VERIFY_TIMEOUT_MS,
    signal: options.signal,
    onLine: options.onLine,
  });
  const output = `${result.stdout}\n${result.stderr}`.trim();
  return {
    ok: result.code === 0,
    output: output.length > TAIL_CHARS ? `…${output.slice(-TAIL_CHARS)}` : output,
  };
}
