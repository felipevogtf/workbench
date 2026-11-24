import {
  slackText,
  splitForSlack,
  summarizeReview,
  toSlackMrkdwn,
} from './slack-format';

describe('summarizeReview', () => {
  const review = [
    '## Resumen',
    'Mueve nginx.',
    '',
    '## Evaluación general del código',
    '### Problemas',
    '- `Makefile:76`: el playbook hace pull de una imagen que **no existe** todavía.',
    '- `ansible/publish.yaml:96`: falta el tag.',
    '',
    '### Sugerencias',
    '- Renombrar algo.',
    '',
    '---',
    '',
    '## Veredicto',
    '`Pedir cambios`: hay un problema que rompe el despliegue.',
  ].join('\n');

  it('takes the outcome and the problems, and nothing from the suggestions', () => {
    expect(summarizeReview(review)).toEqual({
      outcome: 'changes-requested',
      problems: [
        '`Makefile:76`: el playbook hace pull de una imagen que *no existe* todavía.',
        '`ansible/publish.yaml:96`: falta el tag.',
      ],
      hiddenProblems: 0,
    });
  });

  it('has no problems when the review says none was found', () => {
    const out = summarizeReview(
      '### Problemas\nNinguno detectado.\n\n## Veredicto\n`Aprobar`: todo bien.',
    );

    expect(out.problems).toEqual([]);
    expect(out.outcome).toBe('approved');
  });

  it.each([
    ['`Aprobar con comentarios`: ok', 'approved-with-comments'],
    ['`Aprobar`: ok', 'approved'],
    ['`Pedir cambios`: no', 'changes-requested'],
    ['Rechazada: no sirve', 'rejected'],
    ['Quizá', null],
  ])('reads the verdict "%s" as %s', (line, outcome) => {
    expect(summarizeReview(`## Veredicto\n${line}`).outcome).toBe(outcome);
  });

  it('shortens long problems and counts the ones that do not fit', () => {
    const many = Array.from(
      { length: 7 },
      (_, i) => `- p${i} ${'x '.repeat(200)}`,
    );
    const out = summarizeReview(['### Problemas', ...many].join('\n'));

    expect(out.problems).toHaveLength(5);
    expect(out.hiddenProblems).toBe(2);
    expect(out.problems.every((problem) => problem.length <= 161)).toBe(true);
    expect(out.problems[0].endsWith('…')).toBe(true);
  });

  it('returns nothing when the review has neither section', () => {
    expect(summarizeReview('## Resumen\nSolo esto.')).toEqual({
      outcome: null,
      problems: [],
      hiddenProblems: 0,
    });
  });
});

describe('toSlackMrkdwn', () => {
  it('turns headings and bold into Slack bold and links into <url|text>', () => {
    const out = toSlackMrkdwn(
      '## Resumen\nHay **un bug** en [el login](https://x.test/a?b=1&c=2).',
    );

    expect(out).toBe(
      '*Resumen*\nHay *un bug* en <https://x.test/a?b=1&amp;c=2|el login>.',
    );
  });

  it('escapes Slack control characters outside code', () => {
    expect(toSlackMrkdwn('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
  });

  it('keeps code blocks untouched (no heading or bold conversion) and drops the language', () => {
    const out = toSlackMrkdwn('```ts\n# no es título\nconst a = **b**;\n```');

    expect(out).toBe('```\n# no es título\nconst a = **b**;\n```');
  });
});

describe('slackText', () => {
  it('escapes and removes the pipe that would break a link', () => {
    expect(slackText('a | b <c>')).toBe('a ¦ b &lt;c&gt;');
  });
});

describe('splitForSlack', () => {
  it('keeps short text in one chunk', () => {
    expect(splitForSlack('hola\nmundo')).toEqual(['hola\nmundo']);
  });

  it('splits by lines without exceeding the size', () => {
    const chunks = splitForSlack('aaaa\nbbbb\ncccc', 9);

    expect(chunks).toEqual(['aaaa\nbbbb', 'cccc']);
  });

  it('cuts a single line longer than the size', () => {
    const chunks = splitForSlack('x'.repeat(25), 10);

    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
    expect(chunks.join('')).toBe('x'.repeat(25));
  });
});
