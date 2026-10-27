import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { JobUsage, UsageLimits, UsageTokens } from './types';

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly costUsd: number | null = null,
    readonly usage: JobUsage | null = null,
  ) {
    super(message);
    this.name = 'ClaudeError';
  }
}

export interface ClaudeRun {
  bin: string;
  binArgs?: string[];
  model: string;
  systemPrompt: string;
  /** Reemplaza el prompt de sistema de Claude Code (~31.000 tokens) en vez de agregarle el nuestro. */
  replaceSystemPrompt?: boolean;
  /** Esfuerzo con que trabaja (`--effort`); ausente = el del modelo. */
  effort?: string;
  tools: string[];
  /** Servidores MCP que el agente puede usar (JSON de `--mcp-config`); sin esto no tiene ninguno. */
  mcpConfig?: string;
  /** Otras carpetas a las que el agente puede acceder además de la de trabajo (`--add-dir`). */
  addDirs?: string[];
  prompt: string;
  cwd: string;
  /** Variables que se suman a las del runner (por ejemplo, el proyecto de Docker del agente). */
  env?: Record<string, string>;
  timeoutMs: number;
  maxBudgetUsd: number;
  /** Cada línea de registro legible (qué lee, qué edita, qué dice). */
  onLog: (line: string) => void;
  signal?: AbortSignal;
}

export interface ClaudeResult {
  output: string;
  costUsd: number | null;
  usage: JobUsage;
}

/** Un evento del modo `--output-format stream-json`, ya reducido a lo que importa. */
export type StreamEvent =
  | { kind: 'log'; line: string }
  | { kind: 'limits'; limits: UsageLimits }
  | {
      kind: 'result';
      output: string;
      costUsd: number | null;
      tokens: UsageTokens;
      isError: boolean;
    };

const MAX_TEXT_LOG = 280;

function oneLine(text: string, max = MAX_TEXT_LOG): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Lo que más dice de una llamada a una herramienta: el archivo o el comando. */
function toolTarget(input: Record<string, unknown> | undefined): string {
  if (!input) return '';
  const value =
    input.file_path ??
    input.path ??
    input.command ??
    input.pattern ??
    input.description;
  return typeof value === 'string' ? oneLine(value, 160) : '';
}

/** Convierte una línea del stream de Claude en un evento de registro o de resultado; `null` si no interesa. */
export function parseStreamLine(line: string): StreamEvent | null {
  let event: Record<string, any>;
  try {
    event = JSON.parse(line) as Record<string, any>;
  } catch {
    return null;
  }

  if (event.type === 'assistant') {
    const blocks = (event.message?.content ?? []) as Record<string, any>[];
    const parts: string[] = [];
    for (const block of blocks) {
      if (
        block.type === 'text' &&
        typeof block.text === 'string' &&
        block.text.trim()
      ) {
        parts.push(oneLine(block.text));
      } else if (block.type === 'tool_use') {
        parts.push(`→ ${block.name} ${toolTarget(block.input)}`.trim());
      }
    }
    return parts.length > 0 ? { kind: 'log', line: parts.join('\n') } : null;
  }

  // Cómo va el plan: cuánto de la ventana de 5 horas y de la semana se lleva usado, y cuándo se reinician.
  if (event.type === 'rate_limit_event') {
    const windows = event.rate_limit_info?.unifiedWindows as
      | Record<
          string,
          { utilization?: unknown; resetsAt?: unknown } | undefined
        >
      | undefined;
    const limits: UsageLimits = {
      fiveHour: windowOf(windows?.five_hour),
      sevenDay: windowOf(windows?.seven_day),
    };
    return limits.fiveHour || limits.sevenDay
      ? { kind: 'limits', limits }
      : null;
  }

  if (event.type === 'result') {
    return {
      kind: 'result',
      output: typeof event.result === 'string' ? event.result : '',
      tokens: tokensOf(event),
      costUsd:
        typeof event.total_cost_usd === 'number' ? event.total_cost_usd : null,
      isError:
        event.is_error === true ||
        (event.subtype !== undefined && event.subtype !== 'success'),
    };
  }
  return null;
}

/** Una ventana del plan tal como llega (fracción usada y reinicio en segundos desde 1970), o `null`. */
function windowOf(
  raw: { utilization?: unknown; resetsAt?: unknown } | undefined,
): UsageLimits['fiveHour'] {
  if (
    !raw ||
    typeof raw.utilization !== 'number' ||
    typeof raw.resetsAt !== 'number'
  ) {
    return null;
  }
  return {
    used: raw.utilization,
    resetsAt: new Date(raw.resetsAt * 1000).toISOString(),
  };
}

/**
 * Los tokens de la llamada: suma lo de cada modelo que intervino (`modelUsage`), que incluye lo que Claude
 * Code hace por su cuenta además de la respuesta; si no viene, el total de `usage`.
 */
function tokensOf(event: Record<string, any>): UsageTokens {
  const number = (value: unknown) => (typeof value === 'number' ? value : 0);
  const models = Object.values(event.modelUsage ?? {}) as Record<
    string,
    unknown
  >[];
  if (models.length > 0) {
    return models.reduce<UsageTokens>(
      (sum, model) => ({
        input: sum.input + number(model.inputTokens),
        output: sum.output + number(model.outputTokens),
        cacheWrite: sum.cacheWrite + number(model.cacheCreationInputTokens),
        cacheRead: sum.cacheRead + number(model.cacheReadInputTokens),
      }),
      { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    );
  }
  const usage = (event.usage ?? {}) as Record<string, unknown>;
  return {
    input: number(usage.input_tokens),
    output: number(usage.output_tokens),
    cacheWrite: number(usage.cache_creation_input_tokens),
    cacheRead: number(usage.cache_read_input_tokens),
  };
}

/** Mata el proceso y sus hijos (en Windows `kill` solo alcanza al proceso padre). */
function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ya terminó
    }
  }
}

export function claudeArgs(run: ClaudeRun): string[] {
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    run.model,
    run.replaceSystemPrompt ? '--system-prompt' : '--append-system-prompt',
    run.systemPrompt,
    // Sin los hooks, servidores MCP ni ajustes del usuario: el agente solo ve lo del proyecto.
    '--setting-sources',
    'project',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--max-budget-usd',
    String(run.maxBudgetUsd),
  ];
  if (run.effort) args.push('--effort', run.effort);
  if (run.mcpConfig) args.push('--mcp-config', run.mcpConfig);
  if (run.addDirs?.length) args.push('--add-dir', ...run.addDirs);
  if (run.tools.length > 0) args.push('--allowedTools', run.tools.join(','));
  return args;
}

/** Corre `claude -p` con el prompt por stdin y devuelve su respuesta final. */
export function runClaude(run: ClaudeRun): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(run.bin, [...(run.binArgs ?? []), ...claudeArgs(run)], {
      cwd: run.cwd,
      env: run.env ? { ...process.env, ...run.env } : process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let settled = false;
    let buffer = '';
    let stderr = '';
    let final: Extract<StreamEvent, { kind: 'result' }> | null = null;
    let limits: UsageLimits | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run.signal?.removeEventListener('abort', onAbort);
      fn();
    };

    const timer = setTimeout(() => {
      killTree(child.pid);
      finish(() =>
        reject(
          new ClaudeError(
            `El agente tardó más de ${Math.round(run.timeoutMs / 60_000)} min y se canceló`,
          ),
        ),
      );
    }, run.timeoutMs);

    const onAbort = () => {
      killTree(child.pid);
      finish(() => reject(new ClaudeError('Trabajo cancelado')));
    };
    if (run.signal?.aborted) onAbort();
    run.signal?.addEventListener('abort', onAbort);

    const handle = (line: string) => {
      const event = parseStreamLine(line);
      if (!event) return;
      if (event.kind === 'log') run.onLog(event.line);
      else if (event.kind === 'limits') limits = event.limits;
      else final = event;
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        handle(buffer.slice(0, newline).trim());
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < 4000) stderr += chunk;
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          new ClaudeError(
            error.code === 'ENOENT'
              ? `No se encontró "${run.bin}". Instala Claude Code o configura claudeBin`
              : `No se pudo iniciar Claude: ${error.message}`,
          ),
        ),
      );
    });

    child.on('close', (code) => {
      if (buffer.trim()) handle(buffer.trim());
      finish(() => {
        const result = final as Extract<StreamEvent, { kind: 'result' }> | null;
        if (result && !result.isError && result.output.trim()) {
          return resolve({
            output: result.output.trim(),
            costUsd: result.costUsd,
            usage: { tokens: result.tokens, limits },
          });
        }
        const reason =
          result?.output.trim() ||
          stderr.trim() ||
          `terminó con código ${code}`;
        reject(
          new ClaudeError(
            `Claude falló: ${oneLine(reason, 600)}`,
            result?.costUsd ?? null,
            result ? { tokens: result.tokens, limits } : null,
          ),
        );
      });
    });

    child.stdin.on('error', () => undefined);
    child.stdin.end(run.prompt);
  });
}

/**
 * Una llamada mínima para saber cómo va el plan (cuánto de la ventana de 5 horas y de la semana se lleva
 * usado). Reemplaza el prompt de sistema para que gaste unos 3.000 tokens y no 34.000. `null` si falla:
 * es un dato de cortesía, nunca debe romper un trabajo.
 */
export async function probeUsage(options: {
  bin: string;
  binArgs?: string[];
  model?: string;
}): Promise<JobUsage | null> {
  try {
    const result = await runClaude({
      bin: options.bin,
      binArgs: options.binArgs,
      model: options.model ?? 'claude-haiku-4-5-20251001',
      systemPrompt: 'Responde solo: ok',
      replaceSystemPrompt: true,
      tools: [],
      prompt: 'ok',
      cwd: tmpdir(),
      timeoutMs: 60_000,
      maxBudgetUsd: 0.2,
      onLog: () => undefined,
    });
    return result.usage;
  } catch {
    return null;
  }
}
