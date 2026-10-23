import {
  buildPlanPrompt,
  MAX_DESCRIPTION_CHARS,
  MAX_PREVIOUS_PLAN_CHARS,
} from './plan-prompt';
import { TaskContext } from './ports/tasks-gateway.port';

const task: TaskContext = {
  id: 't1',
  name: 'Vista de órdenes de carga',
  description: 'Como conductor quiero ver mi orden',
  projectName: 'Melón',
  stateName: 'En curso',
  priority: 'high',
  startDate: null,
  dueDate: '2026-10-20',
  estimatedHours: 6,
  isLocal: false,
  labels: [{ name: 'MiCamión Web', repoUrl: 'https://github.com/a/mi-camion' }],
};

describe('buildPlanPrompt', () => {
  it('describes the task with the data it has and skips the empty ones', () => {
    const prompt = buildPlanPrompt({ task, tickets: [], repos: [] });

    expect(prompt).toContain('**Título:** Vista de órdenes de carga');
    expect(prompt).toContain('**Proyecto:** Melón');
    expect(prompt).toContain('**Vencimiento:** 2026-10-20');
    expect(prompt).toContain('**Horas estimadas:** 6');
    expect(prompt).toContain('**Etiquetas:** MiCamión Web');
    expect(prompt).not.toContain('**Inicio:**');
  });

  it('says there is no code when there are no repositories', () => {
    const prompt = buildPlanPrompt({ task, tickets: [], repos: [] });
    expect(prompt).toContain('No hay código disponible');
  });

  it('lists the usable repositories by folder and reports the ones that failed', () => {
    const prompt = buildPlanPrompt({
      task,
      tickets: [],
      repos: [
        {
          url: 'https://github.com/a/mi-camion',
          name: 'mi-camion',
          used: true,
          note: null,
        },
        {
          url: 'https://github.com/a/otro',
          name: 'otro',
          used: false,
          note: 'sin main ni master',
        },
      ],
    });

    expect(prompt).toContain('`mi-camion/` — https://github.com/a/mi-camion');
    expect(prompt).not.toContain('No hay código disponible');
    expect(prompt).toContain('https://github.com/a/otro: sin main ni master');
  });

  it('includes the cited tickets', () => {
    const prompt = buildPlanPrompt({
      task,
      repos: [],
      tickets: [
        {
          key: 'MEL-253',
          title: 'Orden de carga',
          stateName: 'Todo',
          labels: ['bug'],
          priority: 'urgent',
          descriptionText: 'Detalle del ticket',
        },
      ],
    });

    expect(prompt).toContain(
      '### MEL-253: Orden de carga (Todo · urgent · bug)',
    );
    expect(prompt).toContain('Detalle del ticket');
  });

  it('truncates a very long description', () => {
    const prompt = buildPlanPrompt({
      task: { ...task, description: 'x'.repeat(MAX_DESCRIPTION_CHARS + 500) },
      tickets: [],
      repos: [],
    });
    expect(prompt).toContain('[…descripción recortada…]');
    expect(prompt.length).toBeLessThan(MAX_DESCRIPTION_CHARS + 1500);
  });

  it('marks a task without description', () => {
    const prompt = buildPlanPrompt({
      task: { ...task, description: null },
      tickets: [],
      repos: [],
    });
    expect(prompt).toContain('(La tarea no tiene descripción.)');
  });

  describe('replanning', () => {
    const conversation = [
      {
        role: 'user' as const,
        content: '¿El endpoint ya existe? Mira también MEL-9.',
      },
      { role: 'assistant' as const, content: 'Sí, está en OrdersController.' },
      { role: 'user' as const, content: 'Entonces no hace falta crearlo.' },
    ];

    it('adds nothing for a normal plan', () => {
      const prompt = buildPlanPrompt({ task, tickets: [], repos: [] });

      expect(prompt).not.toContain('## Plan anterior');
      expect(prompt).not.toContain('Conversación con el usuario');
    });

    it('gives the previous plan, the conversation and what to do with them', () => {
      const prompt = buildPlanPrompt({
        task,
        tickets: [],
        repos: [],
        revision: {
          previousPlan: '## Objetivo\nCrear el endpoint',
          conversation,
        },
      });

      expect(prompt).toContain(
        '## Plan anterior\n\n## Objetivo\nCrear el endpoint',
      );
      expect(prompt).toContain('## Conversación con el usuario sobre el plan');
      expect(prompt).toContain('### Usuario\n¿El endpoint ya existe?');
      expect(prompt).toContain('### Asistente\nSí, está en OrdersController.');
      expect(prompt).toContain('Esta es una replanificación');
      expect(prompt).toContain('Entrega el plan completo y actualizado');
      // El plan anterior va antes que la conversación y las instrucciones van al final.
      expect(prompt.indexOf('## Plan anterior')).toBeLessThan(
        prompt.indexOf('## Conversación con el usuario'),
      );
      expect(prompt.indexOf('## Conversación con el usuario')).toBeLessThan(
        prompt.indexOf('## Qué hacer ahora'),
      );
    });

    it('plans from scratch, saying so, when there is no previous plan', () => {
      const prompt = buildPlanPrompt({
        task,
        tickets: [],
        repos: [],
        revision: { previousPlan: null, conversation },
      });

      expect(prompt).toContain('No hay un plan anterior');
    });

    it('cuts a huge previous plan', () => {
      const prompt = buildPlanPrompt({
        task,
        tickets: [],
        repos: [],
        revision: {
          previousPlan: 'x'.repeat(MAX_PREVIOUS_PLAN_CHARS + 500),
          conversation,
        },
      });

      expect(prompt).toContain('[…plan recortado…]');
      expect(prompt).not.toContain('x'.repeat(MAX_PREVIOUS_PLAN_CHARS + 1));
    });
  });
});

describe('buildPlanPrompt replanning with attachments', () => {
  it('puts the attachments of the conversation within reach of the agent', () => {
    const prompt = buildPlanPrompt({
      task,
      tickets: [],
      repos: [],
      revision: {
        previousPlan: null,
        conversation: [
          {
            role: 'user',
            content: 'Usa este documento',
            attachments: [{ id: 'a1', name: 'requisitos.pdf' }],
          },
        ],
        staged: new Map([
          [
            'a1',
            {
              id: 'a1',
              name: 'requisitos.pdf',
              path: '.attachments/a1-requisitos.pdf',
              kind: 'pdf' as const,
              size: 4096,
            },
          ],
        ]),
      },
    });

    expect(prompt).toContain(
      '- requisitos.pdf (PDF, 4 KB): `.attachments/a1-requisitos.pdf`',
    );
    expect(prompt).toContain('herramienta Read');
  });
});
