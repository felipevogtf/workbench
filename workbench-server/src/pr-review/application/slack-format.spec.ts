import { slackText, splitForSlack, toSlackMrkdwn } from './slack-format';

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
