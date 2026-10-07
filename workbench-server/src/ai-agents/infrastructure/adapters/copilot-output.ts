interface CopilotEvent {
  type?: string;
  data?: { messageId?: string; phase?: string; deltaContent?: string };
}

/**
 * Copilot CLI emite, además de la respuesta, los mensajes de "comentario" que el modelo escribe
 * mientras trabaja ("Voy a revisar el diff…"). Con `--output-format json` cada mensaje trae su fase:
 * solo `final_answer` es la respuesta. Si la salida no trae mensajes en ese formato, se devuelve
 * tal cual.
 */
export function extractCopilotAnswer(stdout: string): string {
  const finals = new Map<string, string>();
  const phases = new Map<string, string>();
  let sawMessages = false;

  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    let event: CopilotEvent;
    try {
      event = JSON.parse(line) as CopilotEvent;
    } catch {
      continue;
    }

    const id = event.data?.messageId;
    if (!id) continue;
    if (event.type === 'assistant.message_start') {
      sawMessages = true;
      phases.set(id, event.data?.phase ?? '');
    } else if (event.type === 'assistant.message_delta') {
      if (phases.get(id) === 'final_answer') {
        finals.set(
          id,
          (finals.get(id) ?? '') + (event.data?.deltaContent ?? ''),
        );
      }
    }
  }

  if (!sawMessages) return stdout.trim();
  return [...finals.values()].join('\n\n').trim();
}
