import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { git } from './git';
import { ignorePath } from './scratch';

/** CodeGraph indexa el código de un repo en un grafo (símbolos, llamadas, dependencias) que los agentes consultan en vez de explorar archivos. */
export interface CodegraphConfig {
  /** Ruta del programa `codegraph`. */
  bin: string;
  /** Argumentos que van antes de los de CodeGraph (para lanzarlo a través de otro programa). */
  binArgs?: string[];
  /** Repos (`organización/repo`) que tienen índice en su clon. */
  repos: string[];
}

/** La herramienta que se le da al agente: solo lectura. */
export const CODEGRAPH_TOOL = 'mcp__codegraph__codegraph_explore';

/** Sin telemetría ni búsqueda de actualizaciones: el agente corre aislado y no debe llamar a nadie. */
const QUIET = {
  CODEGRAPH_TELEMETRY: 'off',
  DO_NOT_TRACK: '1',
  CODEGRAPH_NO_UPDATE_CHECK: '1',
};

const INDEX_DIR = '.codegraph';
const execFileAsync = promisify(execFile);

/** La configuración que se le pasa a `claude --mcp-config` para que arranque el servidor de CodeGraph. */
export function codegraphMcpConfig(config: CodegraphConfig): string {
  return JSON.stringify({
    mcpServers: {
      codegraph: {
        command: config.bin,
        args: [...(config.binArgs ?? []), 'serve', '--mcp'],
        env: QUIET,
      },
    },
  });
}

/**
 * Deja un índice en el worktree: lo copia del clon la primera vez (un índice desde cero tarda minutos) y lo pone al día con lo que la
 * rama cambió. Queda fuera de git. Devuelve si el worktree tiene un índice usable.
 */
export async function prepareIndex(
  config: CodegraphConfig,
  places: { clone: string; worktree: string },
  copy: (from: string, to: string) => Promise<boolean> = copyDir,
  onLog: (line: string) => void = () => undefined,
): Promise<boolean> {
  const target = join(places.worktree, INDEX_DIR);
  const source = join(places.clone, INDEX_DIR);
  await ignorePath(places.worktree, `/${INDEX_DIR}/`);
  if (!existsSync(join(target, 'codegraph.db'))) {
    if (!existsSync(join(source, 'codegraph.db'))) return false;
    // Un worktree nuevo parte de la rama base de ahora: el índice que se le copia tiene que ser de esa rama, no de cuando se indexó.
    await refreshClone(config, places.clone, onLog);
    await mkdir(target, { recursive: true });
    if (!(await copy(source, target))) return false;
  }
  await execFileAsync(
    config.bin,
    [...(config.binArgs ?? []), 'sync', places.worktree],
    {
      env: { ...process.env, ...QUIET },
      timeout: 5 * 60_000,
    },
  ).catch(() => undefined);
  return true;
}

/**
 * Pone el índice del clon al día con la rama base: si esa rama avanzó desde la última vez, adelanta el clon a ella (el clon no se usa
 * para trabajar, solo guarda el índice) y corre `sync`, que es incremental. Un fallo deja el índice como estaba.
 */
async function refreshClone(
  config: CodegraphConfig,
  clone: string,
  onLog: (line: string) => void,
): Promise<void> {
  try {
    const sha = (
      await git(['rev-parse', 'origin/HEAD'], { cwd: clone })
    ).trim();
    const marker = join(clone, INDEX_DIR, 'indexed-at');
    const done = existsSync(marker)
      ? (await readFile(marker, 'utf8')).trim()
      : '';
    if (!sha || done === sha) return;

    const began = Date.now();
    await ignorePath(clone, `/${INDEX_DIR}/`);
    await git(['reset', '--hard', sha], { cwd: clone });
    await execFileAsync(
      config.bin,
      [...(config.binArgs ?? []), 'sync', clone],
      {
        env: { ...process.env, ...QUIET },
        timeout: 10 * 60_000,
      },
    );
    await writeFile(marker, sha);
    onLog(
      `Índice del clon al día con ${sha.slice(0, 8)}: ${((Date.now() - began) / 1000).toFixed(1)} s`,
    );
  } catch (error) {
    onLog(
      `No se pudo actualizar el índice del clon: ${(error as Error).message.slice(0, 200)}`,
    );
  }
}

async function copyDir(from: string, to: string): Promise<boolean> {
  return execFileAsync('cp', ['-a', '--reflink=auto', `${from}/.`, to]).then(
    () => true,
    () => false,
  );
}

/** Una regla corta para el prompt de sistema: lo que está ahí pesa más que una sección al final de un prompt largo. */
export const CODEGRAPH_SYSTEM_RULE =
  'Para ubicar código (dónde está algo, cómo se conecta, qué archivos toca un cambio) llama primero a `codegraph_explore`; usa Grep o Read solo para lo que esa consulta no te dé.';

/** Va AL COMIENZO del prompt del trabajo, para que el agente consulte el grafo antes de explorar archivos. */
export function codegraphNotice(
  repos: { fullName: string; dir: string }[],
): string {
  const list = repos
    .map((repo) => `- ${repo.fullName}: \`projectPath\` = ${repo.dir}`)
    .join('\n');
  return `# Antes de explorar el código: consulta el grafo
Tienes la herramienta \`codegraph_explore\`, un índice de los símbolos, las llamadas y las dependencias del código. ANTES de usar Grep, Glob o Read para ubicar algo, llámala: con los nombres de los símbolos o los términos (o una pregunta en lenguaje natural) devuelve el código y sus relaciones, y te ahorra leer archivo por archivo. Después lee solo lo que necesites. Si vas a decir qué archivos toca un ticket, sácalos de ahí.
Pasa \`projectPath\` para elegir el repositorio:
${list}
Refleja el estado del código en la carpeta de trabajo; si algo no aparece, búscalo con las herramientas de siempre.

`;
}
