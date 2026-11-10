import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentRunInput,
  AgentRunnerPort,
} from '@ai-agents/domain/ports/agent-runner.port';
import { runCli } from './cli-process';
import { redact, timeoutMs } from './cli-config';
import { parseClaudeJson } from './claude-output';

/**
 * Ejecuta el CLI de Claude en modo no interactivo (`claude -p`).
 * El system prompt del agente va con --append-system-prompt; el contexto de la
 * tarea por stdin. Las herramientas se restringen con --allowedTools.
 */
@Injectable()
export class ClaudeCliAgentRunnerAdapter implements AgentRunnerPort {
  constructor(private readonly config: ConfigService) {}

  async run(input: AgentRunInput): Promise<string> {
    const args = [
      '-p',
      // En JSON el CLI informa también los tokens y el costo de la llamada.
      '--output-format',
      'json',
      '--model',
      input.model || input.agent.model,
      '--append-system-prompt',
      input.agent.systemPrompt,
    ];
    if (input.agent.allowedTools.length > 0) {
      args.push('--allowedTools', input.agent.allowedTools.join(','));
    }

    const stdout = await runCli({
      label: 'Claude CLI',
      bin: this.config.get<string>('CLAUDE_BIN') || 'claude',
      args,
      cwd: input.workdir,
      stdin: input.prompt,
      timeoutMs: timeoutMs(this.config),
      sanitize: (text) => redact(this.config, text),
      notFoundHint: 'Install it or set CLAUDE_BIN',
    });

    const reply = parseClaudeJson(stdout);
    // Aunque la llamada falle, gastó: se cuenta igual.
    if (reply.usage) input.onUsage?.(reply.usage);
    if (reply.isError || !reply.text) {
      throw new Error(
        `Claude CLI failed: ${redact(this.config, reply.text || stdout).slice(0, 2000)}`,
      );
    }
    return reply.text;
  }
}
