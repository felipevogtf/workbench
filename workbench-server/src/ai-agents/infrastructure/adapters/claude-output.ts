import { AiCallUsage } from '@ai-agents/domain/ai-call';

export interface ClaudeReply {
  text: string;
  /** `null` si el CLI no informó el consumo. */
  usage: AiCallUsage | null;
  isError: boolean;
}

const number = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/** El evento `result` de `claude -p --output-format json`: un objeto, o una lista de eventos con `--verbose`. */
function resultEvent(parsed: unknown): Record<string, unknown> | null {
  const events = Array.isArray(parsed) ? parsed : [parsed];
  for (const event of events.reverse()) {
    if (
      event &&
      typeof event === 'object' &&
      (event as { type?: unknown }).type === 'result'
    ) {
      return event as Record<string, unknown>;
    }
  }
  return null;
}

/**
 * Lee lo que devuelve `claude -p --output-format json`: el texto de la respuesta y lo que gastó (tokens y costo).
 * Si la salida no es ese JSON (otra versión del CLI, un mensaje suelto), se devuelve tal cual y sin consumo.
 */
export function parseClaudeJson(stdout: string): ClaudeReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { text: stdout.trim(), usage: null, isError: false };
  }

  const event = resultEvent(parsed);
  if (!event) return { text: stdout.trim(), usage: null, isError: false };

  // Suma lo de cada modelo que intervino, que incluye lo que Claude Code hace por su cuenta; si no viene, `usage`.
  const models = Object.values(
    (event.modelUsage ?? {}) as Record<string, Record<string, unknown>>,
  );
  const usage = (event.usage ?? {}) as Record<string, unknown>;
  const tokens: AiCallUsage['tokens'] =
    models.length > 0
      ? models.reduce<AiCallUsage['tokens']>(
          (sum, model) => ({
            input: sum.input + number(model.inputTokens),
            output: sum.output + number(model.outputTokens),
            cacheWrite: sum.cacheWrite + number(model.cacheCreationInputTokens),
            cacheRead: sum.cacheRead + number(model.cacheReadInputTokens),
          }),
          { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
        )
      : {
          input: number(usage.input_tokens),
          output: number(usage.output_tokens),
          cacheWrite: number(usage.cache_creation_input_tokens),
          cacheRead: number(usage.cache_read_input_tokens),
        };

  return {
    text: typeof event.result === 'string' ? event.result.trim() : '',
    usage: { tokens, costUsd: number(event.total_cost_usd) },
    isError:
      event.is_error === true ||
      (event.subtype !== undefined && event.subtype !== 'success'),
  };
}
