import { spawn } from 'node:child_process';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentRunInput,
  AgentRunnerPort,
} from '@ai-agents/domain/ports/agent-runner.port';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const SECRET_ENV_VARS = [
  'BITBUCKET_TOKEN',
  'GITHUB_TOKEN',
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
] as const;

/**
 * Ejecuta el CLI de Claude en modo no interactivo (`claude -p`).
 * El system prompt del agente va con --append-system-prompt; el contexto de la
 * tarea por stdin. Las herramientas se restringen con --allowedTools.
 */
@Injectable()
export class ClaudeCliAgentRunnerAdapter implements AgentRunnerPort {
  private readonly logger = new Logger(ClaudeCliAgentRunnerAdapter.name);

  constructor(private readonly config: ConfigService) {}

  run(input: AgentRunInput): Promise<string> {
    const bin = this.config.get<string>('CLAUDE_BIN') || 'claude';
    const timeoutMs = Number(
      this.config.get<string>('AGENT_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS,
    );

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

    return new Promise<string>((resolve, reject) => {
      const child = spawn(bin, args, {
        cwd: input.workdir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(() =>
          reject(new Error(`Agent timed out after ${timeoutMs} ms`)),
        );
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk;
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        const message =
          err.code === 'ENOENT'
            ? `Claude CLI not found ("${bin}"). Install it or set CLAUDE_BIN`
            : `Could not start Claude CLI: ${err.message}`;
        finish(() => reject(new Error(message)));
      });

      child.on('close', (code) => {
        finish(() => {
          if (code !== 0) {
            this.logger.warn(`claude exited with code ${code}`);
            reject(
              new Error(
                `Claude CLI failed (exit ${code}): ${this.sanitize(stderr || stdout).slice(0, 2000)}`,
              ),
            );
            return;
          }
          const output = stdout.trim();
          if (!output) {
            reject(new Error('Claude CLI returned an empty response'));
            return;
          }
          resolve(output);
        });
      });

      child.stdin.on('error', () => undefined);
      child.stdin.end(input.prompt);
    });
  }

  private sanitize(text: string): string {
    let clean = text;
    for (const name of SECRET_ENV_VARS) {
      const secret = this.config.get<string>(name);
      if (secret) clean = clean.split(secret).join('***');
    }
    return clean;
  }
}
