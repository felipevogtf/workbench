import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { CodegraphConfig } from './codegraph';
import type { EnvironmentsConfig } from './environment';
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
  /** Entornos de prueba (contenedores) que el runner levanta por ejecución. Vacío = no levanta nada. */
  environment: Omit<EnvironmentsConfig, 'workDir'>;
  /** El grafo del código que consultan los agentes; ausente = no se usa. */
  codegraph?: CodegraphConfig;
}

export const DEFAULT_CONFIG = {
  claudeBin: 'claude',
  maxBudgetUsd: 5,
  timeoutMinutes: {
    tickets: 25,
    develop: 45,
    review: 15,
    publish: 5,
    final: 25,
    chat: 15,
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
      'Bash(git rm:*)',
      'Bash(cp:*)',
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
    // Lucy, al contestar en el chat, lee lo mismo que un revisor: nunca edita.
    chat: [
      'Read',
      'Grep',
      'Glob',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git show:*)',
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
      chat: tools.chat ?? [...DEFAULT_CONFIG.allowedTools.chat],
    },
    remoteOverrides: (raw.remoteOverrides ?? {}) as Record<string, string>,
    copyFiles: (raw.copyFiles ?? {}) as RunnerConfig['copyFiles'],
    environment: environmentFrom(raw),
    ...codegraphFrom(raw),
  };
}

function codegraphFrom(
  raw: Record<string, unknown>,
): { codegraph: CodegraphConfig } | Record<string, never> {
  const section = raw.codegraph as Partial<CodegraphConfig> | undefined;
  if (!section) return {};
  if (typeof section.bin !== 'string' || !isAbsolute(section.bin))
    fail('codegraph.bin debe ser la ruta completa del programa codegraph');
  if (!Array.isArray(section.repos))
    fail('codegraph.repos debe ser la lista de repositorios con índice');
  return {
    codegraph: { bin: section.bin, repos: section.repos.map(String) },
  };
}

/** `services`, `environments` y sus ajustes: se validan al leer para que un error salga al arrancar, no a mitad de una ejecución. */
function environmentFrom(
  raw: Record<string, unknown>,
): RunnerConfig['environment'] {
  const services = (raw.services ?? {}) as EnvironmentsConfig['services'];
  const environments = (raw.environments ??
    {}) as EnvironmentsConfig['environments'];

  const range = (raw.portRange ?? [20000, 29999]) as unknown;
  if (
    !Array.isArray(range) ||
    range.length !== 2 ||
    !range.every(
      (port) => Number.isInteger(port) && port > 1024 && port < 65536,
    ) ||
    range[0] >= range[1]
  )
    fail('portRange debe ser [desde, hasta] con puertos entre 1025 y 65535');

  for (const [repo, env] of Object.entries(environments)) {
    if (!Array.isArray(env.composeFiles) || env.composeFiles.length === 0)
      fail(`environments["${repo}"].composeFiles es obligatorio`);
    if (!Array.isArray(env.ports))
      fail(`environments["${repo}"].ports es obligatorio`);
    for (const port of env.ports) {
      if (!port.name || (!port.env && !(port.service && port.container)))
        fail(
          `environments["${repo}"].ports: cada puerto necesita name y env, o service y container`,
        );
    }
    // Son rutas dentro del worktree: una que salga de él copiaría o borraría archivos ajenos.
    for (const entry of env.dependencyCache ?? []) {
      for (const path of [entry?.dir, entry?.lock]) {
        if (
          typeof path !== 'string' ||
          !path.trim() ||
          isAbsolute(path) ||
          path.split(/[\/]/).includes('..')
        )
          fail(
            `environments["${repo}"].dependencyCache: dir y lock deben ser rutas relativas dentro del repositorio`,
          );
      }
    }
    if (env.database && !services[env.database.service])
      fail(
        `environments["${repo}"].database usa el servicio «${env.database.service}», que no está en services`,
      );
  }

  const idle = Number(raw.environmentIdleMinutes ?? 120);
  return {
    secretsDir: resolve(
      typeof raw.secretsDir === 'string' && raw.secretsDir.trim()
        ? raw.secretsDir.trim()
        : `${homedir()}/secrets`,
    ),
    portRange: range as [number, number],
    idleMinutes: idle > 0 ? idle : 120,
    services,
    environments,
  };
}
