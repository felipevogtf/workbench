import { extractCopilotAnswer } from './copilot-output';

const start = (id: string, phase: string) =>
  JSON.stringify({
    type: 'assistant.message_start',
    data: { messageId: id, phase },
  });
const delta = (id: string, text: string) =>
  JSON.stringify({
    type: 'assistant.message_delta',
    data: { messageId: id, deltaContent: text },
  });

describe('extractCopilotAnswer', () => {
  it('keeps only the final answer, not the commentary while it works', () => {
    const out = [
      start('a', 'commentary'),
      delta('a', 'Voy a revisar el diff.'),
      '{"type":"session.background_tasks_changed","data":{}}',
      start('b', 'final_answer'),
      delta('b', '## Resumen\n'),
      delta('b', 'Todo bien'),
      '{"type":"result","exitCode":0}',
    ].join('\n');

    expect(extractCopilotAnswer(out)).toBe('## Resumen\nTodo bien');
  });

  it('returns the plain text when the output is not in the JSON format', () => {
    expect(extractCopilotAnswer('  respuesta simple \n')).toBe(
      'respuesta simple',
    );
  });

  it('returns nothing when there was commentary but no final answer', () => {
    const out = [start('a', 'commentary'), delta('a', 'Voy a revisar')].join(
      '\n',
    );
    expect(extractCopilotAnswer(out)).toBe('');
  });
});
