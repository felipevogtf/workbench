import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentRunInput,
  AgentRunnerPort,
} from '@ai-agents/domain/ports/agent-runner.port';
import { redact, timeoutMs } from './cli-config';
import { extractCopilotAnswer } from './copilot-output';
import { runCli } from './cli-process';

// Equivalencia de las herramientas de solo lectura del agente en los permisos de Copilot CLI.
// Leer archivos (Read/Grep/Glob) dentro del directorio de trabajo no pide permiso; solo los comandos
// de shell hay que habilitarlos uno a uno.
const SHELL_PERMISSIONS: Record<string, string> = {
  'Bash(git diff:*)': 'shell(git diff:*)',
  'Bash(git log:*)': 'shell(git log:*)',
  'Bash(git show:*)': 'shell(git show:*)',
};

/**
 * Ejecuta GitHub Copilot CLI en modo no interactivo (`copilot -p`). No tiene un flag de system
 * prompt, así que las instrucciones del agente van delante del contexto de la tarea. Todo lo que
 * escribe o accede a URLs se deniega.
 */
@Injectable()
export class CopilotCliAgentRunnerAdapter implements AgentRunnerPort {
  constructor(private readonly config: ConfigService) {}

  async run(input: AgentRunInput): Promise<string> {
    const prompt = `${input.agent.systemPrompt}\n\n---\n\n${input.prompt}`;
    const args = [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--disable-builtin-mcps',
      '--model',
      input.model || input.agent.model,
    ];

    for (const tool of input.agent.allowedTools) {
      const permission = SHELL_PERMISSIONS[tool];
      if (permission) args.push('--allow-tool', permission);
    }
    args.push('--deny-tool', 'write', '--deny-tool', 'url');

    // Copilot lee el token de GH_TOKEN/GITHUB_TOKEN. GITHUB_TOKEN del servidor es el de las PRs
    // (con acceso a repos), así que el CLI recibe solo el suyo.
    const env = { ...process.env };
    const token = this.config.get<string>('COPILOT_TOKEN');
    if (token) {
      env.COPILOT_GITHUB_TOKEN = token;
    }
    delete env.GITHUB_TOKEN;
    delete env.GH_TOKEN;
    delete env.BITBUCKET_TOKEN;

    const stdout = await runCli({
      label: 'Copilot CLI',
      bin: this.config.get<string>('COPILOT_BIN') || 'copilot',
      args,
      cwd: input.workdir,
      env,
      timeoutMs: timeoutMs(this.config),
      sanitize: (text) => redact(this.config, text),
      notFoundHint: 'Install @github/copilot or set COPILOT_BIN',
    });

    const answer = extractCopilotAnswer(stdout);
    if (!answer) {
      throw new Error('Copilot CLI returned no final answer');
    }
    return answer;
  }
}
