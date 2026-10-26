import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  ClaudeError,
  claudeArgs,
  parseStreamLine,
  probeUsage,
  runClaude,
  type ClaudeRun,
} from './claude';
import { FAKE_CLAUDE, tempDir } from './test-helpers';

describe('parseStreamLine', () => {
  it('turns what the assistant says and does into log lines', () => {
    const event = parseStreamLine(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Voy a leer\n el archivo' },
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: 'src/a.ts' },
            },
          ],
        },
      }),
    );

    assert.deepEqual(event, {
      kind: 'log',
      line: 'Voy a leer el archivo\n→ Read src/a.ts',
    });
  });

  it('shows the command of a Bash call', () => {
    const event = parseStreamLine(
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } },
          ],
        },
      }),
    );

    assert.deepEqual(event, { kind: 'log', line: '→ Bash npm test' });
  });

  it('reads the final result with its cost', () => {
    const event = parseStreamLine(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Listo',
        total_cost_usd: 0.5,
      }),
    );

    assert.deepEqual(event, {
      kind: 'result',
      output: 'Listo',
      costUsd: 0.5,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      isError: false,
    });
  });

  it('adds up the tokens of every model that took part, cache included', () => {
    const event = parseStreamLine(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Listo',
        modelUsage: {
          a: {
            inputTokens: 10,
            outputTokens: 20,
            cacheCreationInputTokens: 300,
            cacheReadInputTokens: 4000,
          },
          b: {
            inputTokens: 1,
            outputTokens: 2,
            cacheCreationInputTokens: 3,
            cacheReadInputTokens: 4,
          },
        },
      }),
    );

    assert.deepEqual(event && 'tokens' in event ? event.tokens : null, {
      input: 11,
      output: 22,
      cacheWrite: 303,
      cacheRead: 4004,
    });
  });

  it('falls back to the total usage when there is no detail by model', () => {
    const event = parseStreamLine(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Listo',
        usage: {
          input_tokens: 7,
          output_tokens: 8,
          cache_creation_input_tokens: 9,
          cache_read_input_tokens: 10,
        },
      }),
    );

    assert.deepEqual(event && 'tokens' in event ? event.tokens : null, {
      input: 7,
      output: 8,
      cacheWrite: 9,
      cacheRead: 10,
    });
  });

  it('reads how the plan is going: what is used of the 5 hours and of the week, and when each resets', () => {
    const event = parseStreamLine(
      JSON.stringify({
        type: 'rate_limit_event',
        rate_limit_info: {
          unifiedWindows: {
            five_hour: { utilization: 0.24, resetsAt: 1792996800 },
            seven_day: { utilization: 0.03, resetsAt: 1793552400 },
          },
        },
      }),
    );

    assert.deepEqual(event, {
      kind: 'limits',
      limits: {
        fiveHour: { used: 0.24, resetsAt: '2026-10-26T06:40:00.000Z' },
        sevenDay: { used: 0.03, resetsAt: '2026-11-01T17:00:00.000Z' },
      },
    });
  });

  it('ignores a rate limit event without the windows', () => {
    assert.equal(
      parseStreamLine(
        JSON.stringify({ type: 'rate_limit_event', rate_limit_info: {} }),
      ),
      null,
    );
  });

  it('marks as error a result that is not a success', () => {
    const event = parseStreamLine(
      JSON.stringify({
        type: 'result',
        subtype: 'error_max_budget_usd',
        result: '',
      }),
    );

    assert.equal(event?.kind === 'result' && event.isError, true);
  });

  it('ignores the rest', () => {
    assert.equal(parseStreamLine('no es json'), null);
    assert.equal(
      parseStreamLine(JSON.stringify({ type: 'system', subtype: 'init' })),
      null,
    );
    assert.equal(
      parseStreamLine(
        JSON.stringify({ type: 'assistant', message: { content: [] } }),
      ),
      null,
    );
  });
});

function run(overrides: Partial<ClaudeRun> = {}): ClaudeRun {
  return {
    bin: process.execPath,
    binArgs: [FAKE_CLAUDE],
    model: 'claude-sonnet-5-5',
    systemPrompt: 'Eres un agente',
    tools: ['Read', 'Grep'],
    prompt: 'Hola',
    cwd: tempDir('claude'),
    timeoutMs: 20_000,
    maxBudgetUsd: 3,
    onLog: () => undefined,
    ...overrides,
  };
}

describe('claudeArgs', () => {
  it('runs print mode isolated from the user settings and sessions, with a spending cap', () => {
    const args = claudeArgs(run());

    assert.deepEqual(args.slice(0, 4), [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
    ]);
    assert.equal(args[args.indexOf('--setting-sources') + 1], 'project');
    assert.ok(args.includes('--strict-mcp-config'));
    assert.ok(args.includes('--no-session-persistence'));
    assert.equal(args[args.indexOf('--max-budget-usd') + 1], '3');
    assert.equal(args[args.indexOf('--allowedTools') + 1], 'Read,Grep');
  });

  it('appends our system prompt to the one of Claude Code, or replaces it when asked', () => {
    assert.ok(claudeArgs(run()).includes('--append-system-prompt'));
    assert.ok(!claudeArgs(run()).includes('--system-prompt'));

    const replaced = claudeArgs(run({ replaceSystemPrompt: true }));
    assert.ok(replaced.includes('--system-prompt'));
    assert.ok(!replaced.includes('--append-system-prompt'));
  });

  it('passes the effort of the agent, and none when it has none', () => {
    const args = claudeArgs(run({ effort: 'low' }));
    assert.equal(args[args.indexOf('--effort') + 1], 'low');
    assert.ok(!claudeArgs(run()).includes('--effort'));
  });

  it('does not pass --allowedTools when no tool is allowed', () => {
    assert.ok(!claudeArgs(run({ tools: [] })).includes('--allowedTools'));
  });
});

describe('runClaude', () => {
  it('returns the final answer and the cost, logging what happened on the way', async () => {
    const lines: string[] = [];
    const result = await runClaude(run({ onLog: (line) => lines.push(line) }));

    assert.equal(result.output, 'Hecho');
    assert.equal(result.costUsd, 0.25);
    // Cuánto gastó (todos los modelos que intervinieron) y cómo iba el plan mientras corría.
    assert.deepEqual(result.usage, {
      tokens: { input: 110, output: 55, cacheWrite: 1000, cacheRead: 2000 },
      limits: {
        fiveHour: { used: 0.24, resetsAt: '2026-10-26T06:40:00.000Z' },
        sevenDay: { used: 0.03, resetsAt: '2026-11-01T17:00:00.000Z' },
      },
    });
    assert.deepEqual(lines, [
      'Voy a mirar el repositorio',
      '→ Read src/index.ts',
    ]);
  });

  it('sends the prompt by stdin and the system prompt and model by arguments', async () => {
    const file = join(tempDir('args'), 'args.json');
    process.env.FAKE_CLAUDE_ARGS_FILE = file;
    try {
      await runClaude(run({ prompt: 'Un prompt largo\ncon líneas' }));
    } finally {
      delete process.env.FAKE_CLAUDE_ARGS_FILE;
    }

    const seen = JSON.parse(readFileSync(file, 'utf8')) as {
      args: string[];
      prompt: string;
    };
    assert.equal(seen.prompt, 'Un prompt largo\ncon líneas');
    assert.equal(
      seen.args[seen.args.indexOf('--append-system-prompt') + 1],
      'Eres un agente',
    );
    assert.equal(
      seen.args[seen.args.indexOf('--model') + 1],
      'claude-sonnet-5-5',
    );
  });

  it('fails with the message of the agent and keeps the cost', async () => {
    process.env.FAKE_FAIL = '1';
    try {
      await assert.rejects(runClaude(run()), (error: unknown) => {
        assert.ok(error instanceof ClaudeError);
        assert.match(error.message, /Sin crédito/);
        assert.equal(error.costUsd, 0.01);
        return true;
      });
    } finally {
      delete process.env.FAKE_FAIL;
    }
  });

  it('stops the agent when it takes too long', async () => {
    process.env.FAKE_SLEEP_MS = '5000';
    try {
      await assert.rejects(runClaude(run({ timeoutMs: 300 })), /tardó/);
    } finally {
      delete process.env.FAKE_SLEEP_MS;
    }
  });

  it('stops the agent when the job is cancelled', async () => {
    process.env.FAKE_SLEEP_MS = '5000';
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);
    try {
      await assert.rejects(
        runClaude(run({ signal: controller.signal })),
        /cancelado/,
      );
    } finally {
      delete process.env.FAKE_SLEEP_MS;
    }
  });

  it('says so when claude is not installed', async () => {
    await assert.rejects(
      runClaude(run({ bin: 'claude-que-no-existe', binArgs: [] })),
      /No se encontró/,
    );
  });
});

describe('probeUsage', () => {
  it('asks for almost nothing and brings back how the plan is going', async () => {
    const file = join(tempDir('args'), 'args.json');
    process.env.FAKE_CLAUDE_ARGS_FILE = file;
    try {
      const usage = await probeUsage({
        bin: process.execPath,
        binArgs: [FAKE_CLAUDE],
      });

      assert.equal(usage?.limits?.fiveHour?.used, 0.24);
      const seen = JSON.parse(readFileSync(file, 'utf8')) as { args: string[] };
      // Sin el prompt de sistema de Claude Code ni herramientas: gasta unos pocos miles de tokens.
      assert.ok(seen.args.includes('--system-prompt'));
      assert.ok(!seen.args.includes('--allowedTools'));
    } finally {
      delete process.env.FAKE_CLAUDE_ARGS_FILE;
    }
  });

  it('gives null, never an error, when Claude fails', async () => {
    assert.equal(await probeUsage({ bin: 'no-existe-este-programa' }), null);
  });
});
