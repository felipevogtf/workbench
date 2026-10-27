import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
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
): Promise<boolean> {
  const target = join(places.worktree, INDEX_DIR);
  const source = join(places.clone, INDEX_DIR);
  await ignorePath(places.worktree, `/${INDEX_DIR}/`);
  if (!existsSync(join(target, 'codegraph.db'))) {
    if (!existsSync(join(source, 'codegraph.db'))) return false;
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

async function copyDir(from: string, to: string): Promise<boolean> {
  return execFileAsync('cp', ['-a', '--reflink=auto', `${from}/.`, to]).then(
    () => true,
    () => false,
  );
}

/** Lo que se le agrega al prompt para que use el grafo antes de leer archivos. */
export function codegraphNotice(
  repos: { fullName: string; dir: string }[],
): string {
  const list = repos
    .map((repo) => `- ${repo.fullName}: \`projectPath\` = ${repo.dir}`)
    .join('\n');
  return `

# Grafo del código
Tienes la herramienta \`codegraph_explore\`, un índice de los símbolos, las llamadas y las dependencias del código. Úsala PRIMERO para ubicar dónde está algo, cómo se conecta y qué archivos toca un cambio, antes de leer o buscar archivo por archivo: una consulta con los nombres de los símbolos o los términos (o una pregunta en lenguaje natural) devuelve el código y sus relaciones. Después lee solo lo que necesites.
Pasa \`projectPath\` para elegir el repositorio:
${list}
Refleja el estado del código en la carpeta de trabajo; si algo no aparece, búscalo con las herramientas de siempre.`;
}
