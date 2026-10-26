import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { JobKind } from './types';

export interface RunnerConfig {
  /** Dirección del servidor, con `/api`. Ej.: `http://personal-task-manager:4321/api`. */
  serverUrl: string;
  /** Token del runner (se genera en la app). */
  token: string;
  /** Carpeta donde se clonan los repos y se crean las ramas de trabajo. */
  workDir: string;
  claudeBin: string;
  /** Argumentos que van antes de los de Claude (para lanzarlo a través de otro programa). */
  claudeBinArgs: string[];
  /** Tope de gasto de cada trabajo de un agente, en dólares. */
  maxBudgetUsd: number;
  /** Tiempo máximo de cada tipo de trabajo, en minutos. */
  timeoutMinutes: Record<JobKind, number>;
  /**
   * Lo máximo que cada tipo de trabajo puede usar. Manda sobre lo que pida el servidor: un agente
   * solo recibe las herramientas que están en su lista Y en esta.
   */
  allowedTools: Record<Exclude<JobKind, 'publish'>, string[]>;
  /** Repos que se clonan de otra dirección (`organización/repo` → URL). Para espejos locales y pruebas. */
  remoteOverrides: Record<string, string>;
  /**
   * Archivos que se copian al worktree nuevo de un repo (`organización/repo`), p. ej. el `environment.ts`
   * que el repo no versiona y se parte de una plantilla. Rutas relativas a la raíz del repo.
   */
  copyFiles: Record<string, { from: string; to: string }[]>;
}

export const DEFAULT_CONFIG = {
  claudeBin: 'claude',
  maxBudgetUsd: 5,
  timeoutMinutes: {
    tickets: 15,
    develop: 45,
    review: 15,
    publish: 5,
    final: 25,
  },
  allowedTools: {
    tickets: ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)'],
    develop: [
      'Read',
      'Grep',
      'Glob',
      'Edit',
      'Write',
      'Bash(git status:*)',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git restore:*)',
      'Bash(git checkout --:*)',
      'Bash(npm install:*)',
      'Bash(npm i:*)',
      'Bash(npm ci:*)',
      'Bash(npm test:*)',
      'Bash(npm run test:*)',
      'Bash(npm run lint:*)',
      'Bash(npm run build:*)',
    ],
    review: [
      'Read',
      'Grep',
      'Glob',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git show:*)',
      'Bash(npm test:*)',
      'Bash(npm run test:*)',
      'Bash(npm run lint:*)',
      'Bash(npm run build:*)',
    ],
    // La revisión final lee y corre lo mismo que una revisión: nunca edita.
    final: [
      'Read',
      'Grep',
      'Glob',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git show:*)',
      'Bash(npm test:*)',
      'Bash(npm run test:*)',
      'Bash(npm run lint:*)',
      'Bash(npm run build:*)',
    ],
  },
  remoteOverrides: {},
  copyFiles: {},
} as const;

export const CONFIG_FILE = 'runner.config.json';

/** Las herramientas que un agente puede usar de verdad: las que pide el servidor y el runner permite. */
export function effectiveTools(
  requested: readonly string[],
  allowed: readonly string[],
): string[] {
  return requested.filter((tool) => allowed.includes(tool));
}

function fail(message: string): never {
  throw new Error(`Configuración inválida: ${message}`);
}

/**
 * Lee la configuración del archivo (por defecto `runner.config.json` junto a donde se lanza) y de las
 * variables `WORKBENCH_URL` y `WORKBENCH_RUNNER_TOKEN`, que mandan sobre el archivo.
 */
export function loadConfig(
  file: string = process.env.WORKBENCH_RUNNER_CONFIG ?? CONFIG_FILE,
  env: NodeJS.ProcessEnv = process.env,
): RunnerConfig {
  const path = resolve(file);
  let raw: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch (error) {
      fail(`${path} no es un JSON válido (${(error as Error).message})`);
    }
  } else if (!env.WORKBENCH_URL) {
    fail(
      `no existe ${path}. Copia runner.config.example.json y completa los datos`,
    );
  }

  const text = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';

  const serverUrl = (env.WORKBENCH_URL || text(raw.serverUrl)).replace(
    /\/+$/,
    '',
  );
  const token = env.WORKBENCH_RUNNER_TOKEN || text(raw.token);
  const workDir = text(raw.workDir);

  if (!/^https?:\/\//.test(serverUrl))
    fail('serverUrl debe empezar con http:// o https://');
  if (!token.startsWith('wbr_'))
    fail('token no es un token de runner (empieza con wbr_)');
  if (!workDir)
    fail('workDir es obligatorio (carpeta donde se clonan los repos)');

  const timeouts = (raw.timeoutMinutes ?? {}) as Partial<
    Record<JobKind, number>
  >;
  const tools = (raw.allowedTools ?? {}) as Partial<
    Record<keyof RunnerConfig['allowedTools'], string[]>
  >;
  const budget = Number(raw.maxBudgetUsd ?? DEFAULT_CONFIG.maxBudgetUsd);
  if (!(budget > 0)) fail('maxBudgetUsd debe ser mayor que 0');

  return {
    serverUrl,
    token,
    workDir: resolve(workDir),
    claudeBin: text(raw.claudeBin) || DEFAULT_CONFIG.claudeBin,
    claudeBinArgs: Array.isArray(raw.claudeBinArgs)
      ? raw.claudeBinArgs.map(String)
      : [],
    maxBudgetUsd: budget,
    timeoutMinutes: { ...DEFAULT_CONFIG.timeoutMinutes, ...timeouts },
    allowedTools: {
      tickets: tools.tickets ?? [...DEFAULT_CONFIG.allowedTools.tickets],
      develop: tools.develop ?? [...DEFAULT_CONFIG.allowedTools.develop],
      review: tools.review ?? [...DEFAULT_CONFIG.allowedTools.review],
      final: tools.final ?? [...DEFAULT_CONFIG.allowedTools.final],
    },
    remoteOverrides: (raw.remoteOverrides ?? {}) as Record<string, string>,
    copyFiles: (raw.copyFiles ?? {}) as RunnerConfig['copyFiles'],
  };
}
