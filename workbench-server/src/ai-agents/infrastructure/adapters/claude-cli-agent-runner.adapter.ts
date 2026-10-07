import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentRunInput,
  AgentRunnerPort,
} from '@ai-agents/domain/ports/agent-runner.port';
import { runCli } from './cli-process';
import { redact, timeoutMs } from './cli-config';

/**
 * Ejecuta el CLI de Claude en modo no interactivo (`claude -p`).
 * El system prompt del agente va con --append-system-prompt; el contexto de la
 * tarea por stdin. Las herramientas se restringen con --allowedTools.
 */
@Injectable()
export class ClaudeCliAgentRunnerAdapter implements AgentRunnerPort {
  constructor(private readonly config: ConfigService) {}

  run(input: AgentRunInput): Promise<string> {
    const args = [
      '-p',
      '--model',
      input.model || input.agent.model,
      '--append-system-prompt',
      input.agent.systemPrompt,
    ];
    if (input.agent.allowedTools.length > 0) {
      args.push('--allowedTools', input.agent.allowedTools.join(','));
    }

    return runCli({
      label: 'Claude CLI',
      bin: this.config.get<string>('CLAUDE_BIN') || 'claude',
      args,
      cwd: input.workdir,
      stdin: input.prompt,
      timeoutMs: timeoutMs(this.config),
      sanitize: (text) => redact(this.config, text),
      notFoundHint: 'Install it or set CLAUDE_BIN',
    });
  }
}
