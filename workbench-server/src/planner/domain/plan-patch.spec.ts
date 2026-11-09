import {
  PlanPatchError,
  applyPlanPatches,
  parsePlanPatches,
} from './plan-patch';

const block = (search: string, replace: string) =>
  `<<<<<<< BUSCAR\n${search}\n=======\n${replace}\n>>>>>>> REEMPLAZAR`;

describe('parsePlanPatches', () => {
  it('reads every block in order and ignores what is outside them', () => {
    const output = [
      'Claro, estos son los cambios:',
      block('uno', 'UNO'),
      '```',
      block('dos\ndos bis', 'DOS'),
    ].join('\n');

    expect(parsePlanPatches(output)).toEqual([
      { search: 'uno', replace: 'UNO' },
      { search: 'dos\ndos bis', replace: 'DOS' },
    ]);
  });

  it('accepts an empty replacement, which deletes the fragment', () => {
    expect(
      parsePlanPatches('<<<<<<< BUSCAR\nsobra\n=======\n>>>>>>> REEMPLAZAR'),
    ).toEqual([{ search: 'sobra', replace: '' }]);
  });

  it('accepts the English marks and CRLF line breaks', () => {
    expect(
      parsePlanPatches(
        '<<<<<<< SEARCH\r\na\r\n=======\r\nb\r\n>>>>>>> REPLACE',
      ),
    ).toEqual([{ search: 'a', replace: 'b' }]);
  });

  it('returns nothing when there are no blocks', () => {
    expect(parsePlanPatches('## Plan completo\ntexto')).toEqual([]);
  });

  it('refuses a block that is never closed', () => {
    expect(() => parsePlanPatches('<<<<<<< BUSCAR\na\n=======\nb')).toThrow(
      PlanPatchError,
    );
  });
});

describe('applyPlanPatches', () => {
  const plan =
    '## Objetivo\nCrear el endpoint\n\n## Pasos\n1. Migración\n2. Servicio\n3. Pruebas';

  it('replaces only the fragment, leaving the rest untouched', () => {
    const result = applyPlanPatches(plan, [
      { search: '2. Servicio', replace: '2. Servicio y controlador' },
    ]);

    expect(result).toBe(
      '## Objetivo\nCrear el endpoint\n\n## Pasos\n1. Migración\n2. Servicio y controlador\n3. Pruebas',
    );
  });

  it('applies the blocks in order, each on the result of the previous one', () => {
    const result = applyPlanPatches(plan, [
      { search: '1. Migración', replace: '1. Migración y seed' },
      { search: '1. Migración y seed\n2. Servicio', replace: '1. Todo junto' },
    ]);

    expect(result).toContain('1. Todo junto\n3. Pruebas');
  });

  it('can add and delete lines', () => {
    const added = applyPlanPatches(plan, [
      { search: '3. Pruebas', replace: '3. Pruebas\n4. Documentación' },
    ]);
    expect(added.endsWith('3. Pruebas\n4. Documentación')).toBe(true);

    const removed = applyPlanPatches(plan, [
      { search: '\n2. Servicio', replace: '' },
    ]);
    expect(removed).not.toContain('Servicio');
  });

  it('finds a fragment even if the trailing spaces of its lines differ', () => {
    const result = applyPlanPatches('a  \nb\nc', [
      { search: 'a\nb  ', replace: 'X' },
    ]);

    expect(result).toBe('X\nc');
  });

  it('refuses a fragment that is not in the plan, saying which one', () => {
    expect(() =>
      applyPlanPatches(plan, [{ search: '9. Inventado', replace: 'x' }]),
    ).toThrow(/El bloque 1 no coincide.*9\. Inventado/);
  });

  it('refuses a fragment that appears more than once', () => {
    expect(() =>
      applyPlanPatches('igual\notro\nigual', [
        { search: 'igual', replace: 'x' },
      ]),
    ).toThrow(/ambiguo/);
  });

  it('refuses an empty search', () => {
    expect(() =>
      applyPlanPatches(plan, [{ search: '  ', replace: 'x' }]),
    ).toThrow(/BUSCAR está vacío/);
  });

  it('does not change anything when a later block fails', () => {
    expect(() =>
      applyPlanPatches(plan, [
        { search: '3. Pruebas', replace: 'ok' },
        { search: 'no existe', replace: 'x' },
      ]),
    ).toThrow(/El bloque 2/);
    // La función es pura: el plan de entrada sigue igual.
    expect(plan).toContain('3. Pruebas');
  });
});
