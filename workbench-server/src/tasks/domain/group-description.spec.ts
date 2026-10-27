import { composeGroupDescription } from './group-description';

describe('composeGroupDescription', () => {
  const members = [
    {
      key: 'MEL-432',
      name: 'Cambio de concepto',
      description: 'Anulada, no cancelada',
    },
    { key: 'MEL-430', name: 'Tono distinto', description: 'Un canal nuevo' },
    { key: null, name: 'Tarea local', description: null },
  ];

  it('lists the tasks in order, each with its code, name and text', () => {
    const text = composeGroupDescription(null, members);

    expect(text).toContain('grupo de 3 tareas');
    expect(text.indexOf('## 1. MEL-432 — Cambio de concepto')).toBeLessThan(
      text.indexOf('## 2. MEL-430 — Tono distinto'),
    );
    expect(text).toContain('Anulada, no cancelada');
    expect(text).toContain('## 3. Tarea local');
    expect(text).toContain('(sin descripción)');
  });

  it('puts the notes of the group first, only when there are some', () => {
    expect(composeGroupDescription('  ', members)).not.toContain(
      'Notas del grupo',
    );

    const text = composeGroupDescription('MEL-430 depende de MEL-432', members);
    expect(text).toContain('## Notas del grupo\nMEL-430 depende de MEL-432');
    expect(text.indexOf('Notas del grupo')).toBeLessThan(text.indexOf('## 1.'));
  });
});
