import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  buildChatPrompt,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
} from './chat-prompt';
import { remotePullRequest } from './testing/fakes';

const pullRequest = PullRequest.createFromRemote(
  remotePullRequest('7', 'ws/app', {
    title: 'Agrega el GPS',
    sourceBranch: 'feature/gps',
    destBranch: 'develop',
    description: 'Integra el proveedor de GPS.',
  }),
);

describe('buildChatPrompt', () => {
  it('tells the agent which PR it is about and where to find the old and the new code', () => {
    const prompt = buildChatPrompt(pullRequest, [
      { role: 'user', content: 'Qué hace esta PR?' },
    ]);

    expect(prompt).toContain('PR #7: Agrega el GPS');
    expect(prompt).toContain('Repositorio: ws/app');
    expect(prompt).toContain('Rama de la PR: feature/gps -> develop');
    expect(prompt).toContain('origin/feature/gps');
    expect(prompt).toContain('git show origin/develop:ruta/al/archivo');
    expect(prompt).toContain('git diff origin/develop...HEAD');
    expect(prompt).toContain('Integra el proveedor de GPS.');
  });

  it('sends the conversation in order, with who said what', () => {
    const prompt = buildChatPrompt(pullRequest, [
      { role: 'user', content: 'primera pregunta' },
      { role: 'assistant', content: 'primera respuesta' },
      { role: 'user', content: 'segunda pregunta' },
    ]);

    const order = [
      '## Usuario\nprimera pregunta',
      '## Asistente\nprimera respuesta',
      '## Usuario\nsegunda pregunta',
    ].map((text) => prompt.indexOf(text));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(
      prompt.trimEnd().endsWith('Responde al último mensaje del usuario.'),
    ).toBe(true);
  });

  it('keeps only the latest messages and says how many it left out', () => {
    const messages = Array.from(
      { length: MAX_HISTORY_MESSAGES + 3 },
      (_, index) => ({
        role: 'user' as const,
        content: `mensaje-${index}`,
      }),
    );

    const prompt = buildChatPrompt(pullRequest, messages);

    expect(prompt).toContain('(3 mensajes anteriores omitidos)');
    expect(prompt).not.toContain('mensaje-2\n');
    expect(prompt).toContain('mensaje-3\n');
    expect(prompt).toContain(`mensaje-${MAX_HISTORY_MESSAGES + 2}`);
  });

  it('cuts a message that is too long', () => {
    const prompt = buildChatPrompt(pullRequest, [
      { role: 'user', content: 'x'.repeat(MAX_MESSAGE_CHARS + 500) },
    ]);

    expect(prompt).toContain('…(recortado)');
    expect(prompt).not.toContain('x'.repeat(MAX_MESSAGE_CHARS + 1));
  });
});
