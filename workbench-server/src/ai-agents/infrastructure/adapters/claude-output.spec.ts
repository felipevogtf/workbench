import { parseClaudeJson } from './claude-output';

const event = (extra: Record<string, unknown> = {}) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'El plan\n',
  total_cost_usd: 0.42,
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    cache_creation_input_tokens: 30,
    cache_read_input_tokens: 40,
  },
  ...extra,
});

describe('parseClaudeJson', () => {
  it('reads the answer, the tokens and the cost', () => {
    const reply = parseClaudeJson(JSON.stringify(event()));

    expect(reply).toEqual({
      text: 'El plan',
      isError: false,
      usage: {
        tokens: { input: 10, output: 20, cacheWrite: 30, cacheRead: 40 },
        costUsd: 0.42,
      },
    });
  });

  it('adds up every model that took part when the CLI reports them', () => {
    const reply = parseClaudeJson(
      JSON.stringify(
        event({
          modelUsage: {
            a: { inputTokens: 1, outputTokens: 2 },
            b: { inputTokens: 3, cacheReadInputTokens: 4 },
          },
        }),
      ),
    );

    expect(reply.usage?.tokens).toEqual({
      input: 4,
      output: 2,
      cacheWrite: 0,
      cacheRead: 4,
    });
  });

  it('finds the result inside a list of events', () => {
    const reply = parseClaudeJson(
      JSON.stringify([{ type: 'system' }, event(), { type: 'other' }]),
    );
    expect(reply.text).toBe('El plan');
  });

  it('flags an error result', () => {
    const reply = parseClaudeJson(
      JSON.stringify(event({ is_error: true, result: 'boom' })),
    );
    expect(reply.isError).toBe(true);
    expect(reply.text).toBe('boom');
  });

  it('returns plain text untouched and without usage', () => {
    expect(parseClaudeJson(' hola ')).toEqual({
      text: 'hola',
      usage: null,
      isError: false,
    });
  });
});
