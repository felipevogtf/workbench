import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentRunInput,
  AgentRunnerPort,
} from '@ai-agents/domain/ports/agent-runner.port';
import { extractAntigravityAnswer } from './antigravity-output';
import { redact, timeoutMs } from './cli-config';
import { runCli } from './cli-process';

// En modo headless, Antigravity deniega todo lo que no esté permitido en su settings.json. Sus
// herramientas de lectura y búsqueda corren como comandos de shell, así que cada herramienta del
// agente se traduce a los comandos de solo lectura equivalentes. Lo que escribe o sale del
// directorio de trabajo se deniega (la denegación gana a cualquier permiso).
const COMMAND_RULES: Record<string, string[]> = {
  Read: ['command(cat)', 'command(head)', 'command(tail)', 'command(wc)'],
  Grep: ['command(grep)', 'command(rg)'],
  Glob: ['command(ls)', 'command(find)'],
  'Bash(git diff:*)': ['command(git diff)'],
  'Bash(git log:*)': ['command(git log)'],
  'Bash(git show:*)': ['command(git show)'],
};
const DENY_RULES = [
  'write_file(*)',
  'command(rm)',
  'command(regex:curl .*)',
  'command(regex:find .*-exec.*)',
  'command(regex:find .*-delete.*)',
  // Fuera del checkout hay credenciales (el servidor guarda tokens en su entorno y en su home). Se
  // deniega tanto la herramienta de lectura como los comandos que nombren esas rutas. Las reglas
  // regex evitan `\.` (con el CLI deniega todo): se usa `[.]`. Verificado contra agy 1.3.
  'read_file(/app)',
  'read_file(/home)',
  'read_file(/root)',
  'read_file(/etc)',
  'read_file(/proc)',
  'command(regex:.*/app.*)',
  'command(regex:.*/home.*)',
  'command(regex:.*/etc.*)',
  'command(regex:.*/proc.*)',
  'command(regex:.*[.]env.*)',
  'command(regex:.*[.]ssh.*)',
  'command(regex:.*[.][.].*)',
];

interface AntigravitySettings {
  modelProvider?: string;
  permissions?: { allow?: string[]; deny?: string[]; ask?: string[] };
  [key: string]: unknown;
}

/**
 * Ejecuta Antigravity CLI en modo no interactivo (`agy -p`). Sin flag de system prompt, las
 * instrucciones del agente van delante del contexto. Los permisos y el proveedor de modelos se
 * dejan en `~/.gemini/antigravity-cli/settings.json` antes de cada ejecución. Sin `GEMINI_API_KEY`
 * se usa la sesión iniciada con `agy` en el servidor.
 */
@Injectable()
export class AntigravityCliAgentRunnerAdapter implements AgentRunnerPort {
  // Ejecuciones en paralelo editan el mismo archivo: se serializan.
  private settingsLock: Promise<void> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  async run(input: AgentRunInput): Promise<string> {
    await this.ensureSettings(input.agent.allowedTools);

    const prompt = `${input.agent.systemPrompt}\n\n---\n\n${input.prompt}`;
    const stdout = await runCli({
      label: 'Antigravity CLI',
      bin: this.config.get<string>('ANTIGRAVITY_BIN') || 'agy',
      args: [
        '-p',
        prompt,
        '--model',
        input.model || input.agent.model,
        '--output-format',
        'json',
      ],
      cwd: input.workdir,
      env: this.cliEnv(),
      timeoutMs: timeoutMs(this.config),
      sanitize: (text) => redact(this.config, text),
      notFoundHint: 'Install agy or set ANTIGRAVITY_BIN',
    });

    return extractAntigravityAnswer(stdout);
  }

  private cliEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.GITHUB_TOKEN;
    delete env.BITBUCKET_TOKEN;
    return env;
  }

  private ensureSettings(allowedTools: readonly string[]): Promise<void> {
    const next = this.settingsLock.then(() => this.writeSettings(allowedTools));
    this.settingsLock = next.catch(() => undefined);
    return next;
  }

  private async writeSettings(allowedTools: readonly string[]): Promise<void> {
    const path = join(
      this.config.get<string>('ANTIGRAVITY_HOME') || homedir(),
      '.gemini',
      'antigravity-cli',
      'settings.json',
    );

    let settings: AntigravitySettings = {};
    try {
      settings = JSON.parse(
        await readFile(path, 'utf8'),
      ) as AntigravitySettings;
    } catch {
      // Primer uso (o archivo ilegible): se parte de cero.
    }

    if (this.config.get<string>('GEMINI_API_KEY')) {
      settings.modelProvider = 'gemini';
    }

    const allow = new Set([
      // Los checkouts viven en el directorio temporal del sistema.
      `read_file(${tmpdir()})`,
      ...allowedTools.flatMap((tool) => COMMAND_RULES[tool] ?? []),
    ]);
    const permissions = settings.permissions ?? {};
    permissions.allow = [...new Set([...(permissions.allow ?? []), ...allow])];
    permissions.deny = [
      ...new Set([...(permissions.deny ?? []), ...DENY_RULES]),
    ];
    settings.permissions = permissions;

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(settings, null, 2));
  }
}
