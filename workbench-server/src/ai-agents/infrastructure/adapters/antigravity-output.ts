interface AntigravityResult {
  status?: string;
  response?: string;
  error?: string;
  denied_actions?: { action?: string; display_name?: string }[];
}

/** El modelo intentó usar una herramienta no permitida y el CLI terminó sin respuesta. */
export class AntigravityDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AntigravityDeniedError';
  }
}

/**
 * Lee la salida `--output-format json` de Antigravity. Una respuesta vacía casi siempre significa
 * que el modelo quiso usar una herramienta no permitida: se informa cuál, para poder agregar la
 * regla que falta.
 */
export function extractAntigravityAnswer(stdout: string): string {
  let result: AntigravityResult;
  try {
    result = JSON.parse(stdout.trim()) as AntigravityResult;
  } catch {
    // Salida que no es JSON (versión distinta del CLI): se usa tal cual.
    return stdout.trim();
  }

  if (result.status && result.status !== 'SUCCESS') {
    throw new Error(
      `Antigravity CLI ended with status ${result.status}${result.error ? `: ${result.error}` : ''}`,
    );
  }

  const answer = (result.response ?? '').trim();
  if (answer) return answer;

  const denied = (result.denied_actions ?? [])
    .map((action) => action.display_name ?? action.action)
    .filter(Boolean);
  throw new AntigravityDeniedError(
    denied.length > 0
      ? `Antigravity CLI returned an empty response: it was denied ${[...new Set(denied)].join(', ')} (permissions in settings.json)`
      : 'Antigravity CLI returned an empty response',
  );
}
