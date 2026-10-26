// Un `claude -p` de mentira para las pruebas: lee el prompt por stdin y responde en el formato
// `--output-format stream-json`. Lo que hace depende del prompt, igual que un agente de verdad.
const fs = require('node:fs');
const path = require('node:path');

let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (prompt += chunk));
process.stdin.on('end', () => void main());

const emit = (event) => process.stdout.write(JSON.stringify(event) + '\n');

async function main() {
  if (process.env.FAKE_CLAUDE_ARGS_FILE) {
    fs.writeFileSync(
      process.env.FAKE_CLAUDE_ARGS_FILE,
      JSON.stringify({
        args: process.argv.slice(2),
        cwd: process.cwd(),
        prompt,
      }),
    );
  }
  if (process.env.FAKE_SLEEP_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, Number(process.env.FAKE_SLEEP_MS)),
    );
  }

  emit({
    type: 'rate_limit_event',
    rate_limit_info: {
      status: 'allowed',
      unifiedWindows: {
        five_hour: {
          utilization: Number(process.env.FAKE_FIVE_HOUR ?? 0.24),
          resetsAt: 1792996800,
        },
        seven_day: { utilization: 0.03, resetsAt: 1793552400 },
      },
    },
  });
  emit({
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: 'Voy a mirar el repositorio' }],
    },
  });
  emit({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          name: 'Read',
          input: { file_path: 'src/index.ts' },
        },
      ],
    },
  });

  if (process.env.FAKE_FAIL) {
    emit({
      type: 'result',
      subtype: 'success',
      is_error: true,
      result: 'Sin crédito',
      total_cost_usd: 0.01,
    });
    process.exit(1);
  }

  let result = 'Hecho';
  if (prompt.includes('Divide el plan')) {
    result =
      'Claro:\n```json\n' +
      JSON.stringify({
        tickets: [
          {
            title: 'Primero',
            description: 'Hacer lo primero',
            criteria: ['Funciona'],
          },
        ],
      }) +
      '\n```';
  } else if (prompt.includes('Revisas el trabajo')) {
    result = JSON.stringify({
      approved: true,
      summary: 'Todo bien',
      issues: [],
    });
  } else if (
    prompt.includes('Estás desarrollando') &&
    !process.env.FAKE_NO_CHANGES
  ) {
    fs.writeFileSync(
      path.join(process.cwd(), 'feature.txt'),
      `hecho ${Date.now()}\n`,
    );
    result = 'Agregué feature.txt';
  }

  emit({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result,
    total_cost_usd: 0.25,
    modelUsage: {
      'claude-sonnet-5-5': {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 1000,
        cacheReadInputTokens: 2000,
      },
      'claude-haiku-5-5': {
        inputTokens: 10,
        outputTokens: 5,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
    },
  });
}
