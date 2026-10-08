import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

// Credenciales que podrían aparecer en la salida de un CLI que falla.
const SECRET_ENV_VARS = [
  'BITBUCKET_TOKEN',
  'GITHUB_TOKEN',
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'COPILOT_TOKEN',
  'GEMINI_API_KEY',
  'SLACK_XOXC_TOKEN',
  'SLACK_XOXD_COOKIE',
] as const;

export function timeoutMs(config: ConfigService): number {
  return Number(config.get<string>('AGENT_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS);
}

export function redact(config: ConfigService, text: string): string {
  let clean = text;
  for (const name of SECRET_ENV_VARS) {
    const secret = config.get<string>(name);
    if (secret) clean = clean.split(secret).join('***');
  }
  return clean;
}
