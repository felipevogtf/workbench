import { MAX_PREVIOUS_PLAN_CHARS } from './plan-prompt';
import { TaskContext } from './ports/tasks-gateway.port';
import {
  buildTaskChatPrompt,
  MAX_CHAT_HISTORY_MESSAGES,
} from './task-chat-prompt';

const task: TaskContext = {
  id: 't1',
  name: 'Vista de órdenes de carga',
  description: 'Como conductor quiero ver mi orden',
  projectName: 'Melón',
  stateName: 'En curso',
  priority: null,
  startDate: null,
  dueDate: null,
  estimatedHours: 6,
  isLocal: false,
  labels: [{ name: 'API', repoUrl: 'https://github.com/a/api' }],
};

const base = {
  task,
  tickets: [],
  missingTickets: [],
  plan: null,
  repos: [],
  messages: [{ role: 'user' as const, content: '¿Qué falta?' }],
};

describe('buildTaskChatPrompt', () => {
  it('gives the agent the task, its code, the plan and the conversation, in that order', () => {
    const prompt = buildTaskChatPrompt({
      ...base,
      plan: '## Objetivo\nMostrar la orden',
      repos: [
        {
          url: 'https://github.com/a/api',
          name: 'api',
          used: true,
          note: null,
        },
      ],
    });

    expect(prompt).toContain('**Título:** Vista de órdenes de carga');
    expect(prompt).toContain('- `api/` — https://github.com/a/api');
    expect(prompt).toContain('## Plan actual\n\n## Objetivo\nMostrar la orden');
    expect(prompt).toContain('### Usuario\n¿Qué falta?');
    const order = [
      '**Título:**',
      '## Repositorios',
      '## Plan actual',
      '# Conversación',
    ].map((t) => prompt.indexOf(t));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('says the task has no plan yet', () => {
    expect(buildTaskChatPrompt(base)).toContain(
      'Todavía no hay un plan para esta tarea.',
    );
  });

  it('includes the Plane tickets that were read', () => {
    const prompt = buildTaskChatPrompt({
      ...base,
      tickets: [
        {
          key: 'MEL-9',
          title: 'Orden de carga',
          stateName: 'En curso',
          labels: ['api'],
          priority: 'high',
          descriptionText: 'Detalle del ticket',
        },
      ],
    });

    expect(prompt).toContain('## Tickets de Plane');
    expect(prompt).toContain(
      '### MEL-9: Orden de carga (En curso · high · api)',
    );
    expect(prompt).toContain('Detalle del ticket');
  });

  it('warns about the mentioned tickets that could not be read, so they are not invented', () => {
    const prompt = buildTaskChatPrompt({
      ...base,
      missingTickets: ['MEL-404', 'MEL-5'],
    });

    expect(prompt).toContain('no se pudieron leer: MEL-404, MEL-5');
    expect(prompt).toContain('No inventes su contenido');
  });

  it('tells that replanning is what updates the plan', () => {
    expect(buildTaskChatPrompt(base)).toContain('pulsa «Replanificar»');
  });

  it('cuts a huge plan', () => {
    const prompt = buildTaskChatPrompt({
      ...base,
      plan: 'x'.repeat(MAX_PREVIOUS_PLAN_CHARS + 500),
    });

    expect(prompt).toContain('[…plan recortado…]');
    expect(prompt).not.toContain('x'.repeat(MAX_PREVIOUS_PLAN_CHARS + 1));
  });

  it('keeps only the latest messages of a long conversation', () => {
    const messages = Array.from(
      { length: MAX_CHAT_HISTORY_MESSAGES + 4 },
      (_, i) => ({
        role: 'user' as const,
        content: `mensaje-${i}`,
      }),
    );

    const prompt = buildTaskChatPrompt({ ...base, messages });

    expect(prompt).toContain('(4 mensajes anteriores omitidos)');
    expect(prompt).not.toContain('mensaje-3\n');
    expect(prompt).toContain(`mensaje-${MAX_CHAT_HISTORY_MESSAGES + 3}`);
  });
});

describe('buildTaskChatPrompt with attachments', () => {
  it('tells the agent where the attachments of the conversation are', () => {
    const prompt = buildTaskChatPrompt({
      ...base,
      messages: [
        {
          role: 'user',
          content: 'Mira el informe',
          attachments: [{ id: 'a1', name: 'informe.pdf' }],
        },
      ],
      staged: new Map([
        [
          'a1',
          {
            id: 'a1',
            name: 'informe.pdf',
            path: '.attachments/a1-informe.pdf',
            kind: 'pdf' as const,
            size: 2048,
          },
        ],
      ]),
    });

    expect(prompt).toContain(
      '- informe.pdf (PDF, 2 KB): `.attachments/a1-informe.pdf`',
    );
    expect(prompt.indexOf('# Conversación')).toBeLessThan(
      prompt.indexOf('.attachments/a1-informe.pdf'),
    );
  });
});
