import {
  extractJson,
  parseReview,
  parseTickets,
  parseDecision,
  parseDoubts,
  parseFinalReview,
  parseQuestion,
} from './json-output';

describe('extractJson', () => {
  it('reads plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('reads JSON inside a fenced block, ignoring the text around it', () => {
    expect(extractJson('Claro:\n```json\n{"a":1}\n```\nListo.')).toEqual({
      a: 1,
    });
  });

  it('reads JSON surrounded by text without a fence', () => {
    expect(extractJson('Aquí va {"a":{"b":2}} y nada más')).toEqual({
      a: { b: 2 },
    });
  });

  it('skips a fenced block that is not JSON and uses the next candidate', () => {
    expect(extractJson('```ts\nconst a = 1;\n```\n{"ok":true}')).toEqual({
      ok: true,
    });
  });

  it('rejects text without JSON', () => {
    expect(() => extractJson('nada')).toThrow('valid JSON');
  });
});

describe('parseTickets', () => {
  const output = (tickets: unknown) => JSON.stringify({ tickets });

  it('returns the valid tickets, trimmed', () => {
    expect(
      parseTickets(
        output([
          { title: '  A  ', description: ' d ', criteria: [' c ', '', 3] },
        ]),
        5,
      ),
    ).toEqual([
      {
        title: 'A',
        description: 'd',
        level: 'medium',
        criteria: ['c'],
        files: [],
      },
    ]);
  });

  it('keeps the files that the ticket should start from, cleaned and capped', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/f${i}.ts`);
    const [ticket] = parseTickets(
      output([
        {
          title: 'A',
          description: 'd',
          files: [' src/a.ts ', '', 7, ...files],
        },
      ]),
      5,
    );

    expect(ticket.files).toHaveLength(15);
    expect(ticket.files[0]).toBe('src/a.ts');
  });

  it('drops tickets without a title or description', () => {
    const tickets = parseTickets(
      output([
        { title: 'Sin descripción' },
        { description: 'Sin título' },
        { title: 'Bien', description: 'd' },
      ]),
      5,
    );
    expect(tickets.map((t) => t.title)).toEqual(['Bien']);
    expect(tickets[0].criteria).toEqual([]);
  });

  it('keeps only the first `max`', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      title: `T${i}`,
      description: 'd',
    }));
    expect(parseTickets(output(many), 3).map((t) => t.title)).toEqual([
      'T0',
      'T1',
      'T2',
    ]);
  });

  it('rejects an answer without a list or without any valid ticket', () => {
    expect(() => parseTickets('{"otra":1}', 5)).toThrow('"tickets"');
    expect(() => parseTickets(output([{ title: 'x' }]), 5)).toThrow(
      'any valid ticket',
    );
  });
});

describe('parseReview', () => {
  it('reads an approval', () => {
    expect(
      parseReview('{"approved":true,"summary":"Bien","issues":[]}'),
    ).toEqual({ approved: true, summary: 'Bien', issues: [], doubts: '' });
  });

  it('reads what the reviewer left in doubt', () => {
    expect(
      parseReview(
        '{"approved":true,"summary":"Bien","issues":[],"doubts":" No pude probar el modo oscuro "}',
      ).doubts,
    ).toBe('No pude probar el modo oscuro');
  });

  it('reads a rejection with its issues', () => {
    expect(
      parseReview('{"approved":false,"summary":"Falta","issues":["a","b"]}'),
    ).toEqual({
      approved: false,
      summary: 'Falta',
      issues: ['a', 'b'],
      doubts: '',
    });
  });

  it('does not take an unclear verdict as approved', () => {
    expect(() => parseReview('{"approved":"yes"}')).toThrow('"approved"');
    expect(() => parseReview('{"summary":"ok"}')).toThrow('"approved"');
  });
});

describe('parseDoubts', () => {
  it('takes what follows DUDAS:, even when it goes on in the next lines', () => {
    expect(
      parseDoubts(
        'Agregué el banner.\nDUDAS: Supuse que va en el AST.\nNo lo probé.',
      ),
    ).toBe('Supuse que va en el AST.\nNo lo probé.');
  });

  it('is case-insensitive, and null when there are no doubts', () => {
    expect(parseDoubts('dudas: ¿Está bien?')).toBe('¿Está bien?');
    expect(parseDoubts('Terminé sin dudas.')).toBeNull();
    expect(parseDoubts('DUDAS:   ')).toBeNull();
  });
});

describe('parseQuestion', () => {
  it('takes what follows PREGUNTA:, even when it goes on in the next lines', () => {
    expect(
      parseQuestion(
        'No hice cambios.\nPREGUNTA: ¿A o B?\nVeo estas dos opciones.',
      ),
    ).toBe('¿A o B?\nVeo estas dos opciones.');
  });

  it('is case-insensitive, and null when the developer asked nothing', () => {
    expect(parseQuestion('pregunta: ¿Sí?')).toBe('¿Sí?');
    expect(parseQuestion('Terminé: agregué el banner.')).toBeNull();
    expect(parseQuestion('PREGUNTA:   ')).toBeNull();
  });
});

describe('parseDecision', () => {
  it('tells an answer of Lucy from an escalation', () => {
    expect(parseDecision('RESPUESTA: Va en todas las pantallas.')).toEqual({
      kind: 'answer',
      text: 'Va en todas las pantallas.',
    });
    expect(parseDecision('ESCALAR: El plan no lo dice.')).toEqual({
      kind: 'escalate',
      text: 'El plan no lo dice.',
    });
  });

  it('is null without either of the two', () => {
    expect(parseDecision('No sé.')).toBeNull();
    expect(parseDecision('RESPUESTA:')).toBeNull();
  });
});

describe('parseFinalReview', () => {
  const report = (findings: unknown, summary: unknown = 'Resumen') =>
    JSON.stringify({ summary, findings });

  it('reads the summary and the findings', () => {
    expect(
      parseFinalReview(
        report([
          {
            severity: 'high',
            file: 'docker/nginx/dsy.conf',
            issue: 'La ruta no existe',
            suggestion: 'Usar /secured/admin/ea',
          },
        ]),
      ),
    ).toEqual({
      summary: 'Resumen',
      findings: [
        {
          severity: 'high',
          file: 'docker/nginx/dsy.conf',
          issue: 'La ruta no existe',
          suggestion: 'Usar /secured/admin/ea',
        },
      ],
    });
  });

  it('accepts a report with nothing found', () => {
    expect(parseFinalReview(report([], 'Todo en orden'))).toEqual({
      summary: 'Todo en orden',
      findings: [],
    });
  });

  it('puts the most serious first and keeps the order among equals', () => {
    const { findings } = parseFinalReview(
      report([
        { severity: 'low', issue: 'a' },
        { severity: 'high', issue: 'b' },
        { severity: 'medium', issue: 'c' },
        { severity: 'high', issue: 'd' },
      ]),
    );

    expect(findings.map((finding) => finding.issue)).toEqual([
      'b',
      'd',
      'c',
      'a',
    ]);
  });

  it('cleans what the agent wrote: an unknown severity is medium, an empty file is null, and a finding without issue is dropped', () => {
    const { findings } = parseFinalReview(
      report([
        {
          severity: 'catastrófico',
          file: '  ',
          issue: '  Algo  ',
          suggestion: 3,
        },
        { severity: 'high', issue: '' },
        null,
      ]),
    );

    expect(findings).toEqual([
      { severity: 'medium', file: null, issue: 'Algo', suggestion: '' },
    ]);
  });

  it('keeps at most twenty findings', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      severity: 'low',
      issue: `problema ${i}`,
    }));

    expect(parseFinalReview(report(many)).findings).toHaveLength(20);
  });

  it('reads the JSON even with text around it', () => {
    expect(
      parseFinalReview(`Aquí está:\n\`\`\`json\n${report([])}\n\`\`\``),
    ).toEqual({ summary: 'Resumen', findings: [] });
  });

  it('is not a report without a findings list, or without JSON', () => {
    expect(() => parseFinalReview('{"summary":"x"}')).toThrow('"findings"');
    expect(() => parseFinalReview('Todo bien')).toThrow('valid JSON');
  });
});
