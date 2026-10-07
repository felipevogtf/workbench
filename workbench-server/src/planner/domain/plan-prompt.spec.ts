import { buildPlanPrompt, MAX_DESCRIPTION_CHARS } from './plan-prompt';
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
});
