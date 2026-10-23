import { extractJson, parseReview, parseTickets } from './json-output';

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
    ).toEqual([{ title: 'A', description: 'd', criteria: ['c'] }]);
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
    ).toEqual({ approved: true, summary: 'Bien', issues: [] });
  });

  it('reads a rejection with its issues', () => {
    expect(
      parseReview('{"approved":false,"summary":"Falta","issues":["a","b"]}'),
    ).toEqual({ approved: false, summary: 'Falta', issues: ['a', 'b'] });
  });

  it('does not take an unclear verdict as approved', () => {
    expect(() => parseReview('{"approved":"yes"}')).toThrow('"approved"');
    expect(() => parseReview('{"summary":"ok"}')).toThrow('"approved"');
  });
});
