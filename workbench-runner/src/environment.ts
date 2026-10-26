import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import {
  appendFile,
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { git } from './git';
import type { JobKind } from './types';

/** Una base de datos (u otro servicio) que se levanta una vez por ejecución y comparten sus proyectos. */
export interface ServiceConfig {
  image: string;
  /** Puerto dentro del contenedor; en el PC se publica uno libre. */
  containerPort: number;
  env?: Record<string, string>;
  /** Argumentos que van después de la imagen (`--character-set-server=…`). */
  command?: string[];
  /** Se corre con `docker exec` dentro del contenedor hasta que termina bien: el servicio está listo. */
  ready: string[];
  /** Crea un schema (`{{schema}}`) dentro del contenedor. */
  createSchema?: string[];
}

export interface PortConfig {
  name: string;
  /** Variable que el compose lee para publicar este puerto (`COMPOSE_PORT`). */
  env?: string;
  /** Un puerto que el compose fija a mano: se reemplaza con un archivo extra de compose. */
  service?: string;
  container?: number;
}

/** Cómo se levanta un proyecto para probarlo. Lo define quien configura el runner, nunca el agente. */
export interface EnvironmentConfig {
  /** `false` lo deja apagado sin borrar la configuración. */
  enabled?: boolean;
  composeFiles: string[];
  /** Archivo de variables del compose (`--env-file`), relativo al worktree. */
  envFile?: string;
  ports: PortConfig[];
  database?: { service: string; schema: string; testSchema?: string };
  /**
   * Archivos locales que el repo no versiona. `from` es relativo a la carpeta de secretos del proyecto;
   * con `template`, `{{…}}` se reemplaza por los puertos y nombres de esta ejecución.
   */
  files?: { from: string; to: string; template?: boolean }[];
  /** Argumentos de `docker compose up`. */
  up?: string[];
  /** Comandos (con `sh -c`, en el worktree) que dejan el proyecto usable: dependencias, esquema, datos. */
  prepare?: string[];
  /** Direcciones que deben responder antes de dar el entorno por listo. */
  waitFor?: { url: string; timeoutSeconds?: number }[];
}

export interface EnvironmentsConfig {
  workDir: string;
  /** `<carpeta de secretos>/<proyecto>/…`. */
  secretsDir: string;
  portRange: [number, number];
  /** Minutos sin usarse tras los que se baja un entorno que nadie cerró (ejecución cancelada o caída). */
  idleMinutes: number;
  /** Imagen mínima con la que se devuelven al runner los archivos que crearon los contenedores. */
  chownImage?: string;
  services: Record<string, ServiceConfig>;
  environments: Record<string, EnvironmentConfig>;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /** Cada línea de salida, para el registro. */
  onLine?: (line: string) => void;
  signal?: AbortSignal;
}

export type Exec = (
  command: string,
  args: string[],
  options?: ExecOptions,
) => Promise<CommandResult>;

/** Corre un programa sin shell y junta su salida; nunca rechaza por un código distinto de 0. */
export const defaultExec: Exec = (command, args, options = {}) =>
  new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        child.kill('SIGKILL');
      },
      options.timeoutMs ?? 10 * 60_000,
    );
    const onAbort = () => child.kill('SIGKILL');
    options.signal?.addEventListener('abort', onAbort, { once: true });

    let pending = '';
    const feed = (chunk: Buffer, into: 'out' | 'err') => {
      const text = chunk.toString();
      if (into === 'out') stdout += text;
      else stderr += text;
      if (!options.onLine) return;
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) options.onLine(line);
    };
    child.stdout.on('data', (chunk: Buffer) => feed(chunk, 'out'));
    child.stderr.on('data', (chunk: Buffer) => feed(chunk, 'err'));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolvePromise({ code: 127, stdout, stderr: stderr + error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      if (pending.trim()) options.onLine?.(pending);
      resolvePromise({
        code: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr: timedOut ? `${stderr}\n(se pasó del tiempo)` : stderr,
      });
    });
  });

/** ¿Se puede publicar este puerto en el PC? */
export function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const server = createServer();
    server.once('error', () => resolvePromise(false));
    server.listen(port, '0.0.0.0', () =>
      server.close(() => resolvePromise(true)),
    );
  });
}

/** Reemplaza `{{clave}}`; una clave que no existe es un error de configuración, no un texto vacío. */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    if (!(key in vars))
      throw new Error(`Falta el valor «${key}» en la plantilla`);
    return vars[key];
  });
}

/** Las herramientas que el agente recibe además de las suyas cuando hay un entorno levantado. */
export function environmentTools(kind: JobKind): string[] {
  const common = [
    'Bash(docker compose exec:*)',
    'Bash(docker compose ps:*)',
    'Bash(docker compose logs:*)',
    'Bash(wb-curl:*)',
  ];
  return kind === 'develop'
    ? [...common, 'Bash(docker compose restart:*)']
    : kind === 'review' || kind === 'final'
      ? common
      : [];
}

export interface EnvironmentHandle {
  /** Texto que se suma al prompt del agente. */
  notice: string;
  /** Variables con las que corre el agente: dicen a `docker compose` cuál es su proyecto. */
  processEnv: Record<string, string>;
}

interface ProjectEnv {
  project: string;
  processEnv: Record<string, string>;
  ports: Record<string, number>;
  schema?: string;
  /** El worktree donde se levantó: sus archivos nuevos pueden quedar a nombre de root. */
  dir?: string;
  warnings: string[];
  failure?: string;
}

interface ExecutionEnv {
  tag: string;
  lastUsed: number;
  services: Map<string, { container: string; port: number }>;
  projects: Map<string, ProjectEnv>;
  taken: Set<number>;
}

const slug = (text: string, max = 20) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');

export class Environments {
  private readonly executions = new Map<string, ExecutionEnv>();

  constructor(
    private readonly config: EnvironmentsConfig,
    private readonly exec: Exec = defaultExec,
    private readonly isPortFree: (
      port: number,
    ) => Promise<boolean> = portIsFree,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((done) => setTimeout(done, ms)),
    private readonly fetchUrl: (url: string) => Promise<number> = async (url) =>
      (await fetch(url, { signal: AbortSignal.timeout(5_000) })).status,
  ) {}

  has(repoFullName: string): boolean {
    return (
      this.config.environments[repoFullName]?.enabled !== false &&
      repoFullName in this.config.environments
    );
  }

  /**
   * Deja listo el entorno del proyecto para esta ejecución (la primera vez lo levanta, después lo reutiliza).
   * Un entorno que no se pudo levantar no detiene el trabajo: el agente recibe el aviso y sigue sin él.
   */
  async ensure(input: {
    executionId: string;
    repo: { fullName: string };
    dir: string;
    onLog: (line: string) => void;
    signal?: AbortSignal;
  }): Promise<EnvironmentHandle | null> {
    const { repo, onLog } = input;
    if (!this.has(repo.fullName)) return null;
    const config = this.config.environments[repo.fullName];

    const run = this.executionOf(input.executionId);
    run.lastUsed = Date.now();
    let project = run.projects.get(repo.fullName);
    if (!project) {
      onLog(`Levantando el entorno de ${repo.fullName}…`);
      try {
        project = await this.bringUp(run, repo.fullName, config, input);
        onLog(
          project.warnings.length > 0
            ? `Entorno arriba, con avisos: ${project.warnings.join(' · ')}`
            : 'Entorno arriba',
        );
      } catch (error) {
        const reason = (error as Error).message;
        onLog(`No se pudo levantar el entorno: ${reason}`);
        project = {
          project: '',
          processEnv: {},
          ports: {},
          dir: input.dir,
          warnings: [],
          failure: reason,
        };
        // Lo que alcanzó a quedar arriba se baja: un entorno a medias no le sirve a nadie.
        await this.down(run.tag);
        run.services.clear();
        await this.chown(input.dir);
      }
      run.projects.set(repo.fullName, project);
    }
    run.lastUsed = Date.now();
    if (project.failure)
      return { notice: this.failureNotice(project.failure), processEnv: {} };
    const bin = await this.installCurl();
    return {
      notice: this.notice(project),
      processEnv: {
        ...project.processEnv,
        PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      },
    };
  }

  /** Deja `wb-curl` donde el agente lo encuentre: una carpeta propia del runner, al principio del PATH. */
  private async installCurl(): Promise<string> {
    const bin = join(this.config.workDir, 'bin');
    await mkdir(bin, { recursive: true });
    const path = join(bin, 'wb-curl');
    await writeFile(
      path,
      `#!/bin/sh\nexec "${process.execPath}" "${join(__dirname, 'curl.js')}" "$@"\n`,
      { mode: 0o755 },
    );
    return bin;
  }

  /**
   * Lo que un contenedor crea en el worktree (`vendor/`, caché) queda a nombre de root y el runner no puede ni
   * borrarlo ni sobrescribirlo: se devuelve al usuario del runner. Sin entorno levantado no hace nada.
   */
  async reclaim(executionId: string, dir: string): Promise<void> {
    if (!this.executions.get(executionId)?.projects.size || !existsSync(dir))
      return;
    await this.chown(dir);
  }

  private async chown(dir: string): Promise<void> {
    const uid = process.getuid?.() ?? 1000;
    const gid = process.getgid?.() ?? 1000;
    await this.exec('docker', [
      'run',
      '--rm',
      '-v',
      `${dir}:/wb-dir`,
      this.config.chownImage ?? 'alpine:3.20',
      'chown',
      '-R',
      `${uid}:${gid}`,
      '/wb-dir',
    ]).catch(() => undefined);
  }

  /** Baja y borra todo lo de una ejecución. */
  async tearDown(executionId: string, onLog?: (line: string) => void) {
    const run = this.executions.get(executionId);
    if (!run) return;
    this.executions.delete(executionId);
    await this.down(run.tag);
    for (const project of run.projects.values())
      if (project.dir && existsSync(project.dir)) await this.chown(project.dir);
    onLog?.(
      'Entorno borrado (contenedores, redes y volúmenes de la ejecución)',
    );
  }

  /** Baja los entornos que nadie usa hace rato (ejecuciones canceladas o que fallaron). */
  async sweepIdle(now = Date.now()): Promise<string[]> {
    const gone: string[] = [];
    for (const [id, run] of this.executions) {
      if (now - run.lastUsed > this.config.idleMinutes * 60_000) {
        await this.tearDown(id);
        gone.push(id);
      }
    }
    return gone;
  }

  /** Al arrancar el runner no hay entornos en curso: todo lo que tenga nuestra marca quedó huérfano. */
  async sweepOrphans(): Promise<number> {
    const list = await this.exec('docker', [
      'ps',
      '-a',
      '--format',
      '{{.ID}}|{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Label "wb.exec"}}',
    ]);
    if (list.code !== 0) return 0;
    const orphans = list.stdout
      .split('\n')
      .map((line) => line.trim().split('|'))
      .filter(
        ([id, , project, tag]) => id && (project?.startsWith('wb-') || tag),
      )
      .map(([id]) => id);
    if (orphans.length === 0) return 0;
    await this.exec('docker', ['rm', '-f', '-v', ...orphans]);
    await this.removeNetworks('wb-');
    return orphans.length;
  }

  private executionOf(executionId: string): ExecutionEnv {
    let run = this.executions.get(executionId);
    if (!run) {
      const tag = `wb-${createHash('sha1').update(executionId).digest('hex').slice(0, 8)}`;
      run = {
        tag,
        lastUsed: Date.now(),
        services: new Map(),
        projects: new Map(),
        taken: new Set(),
      };
      this.executions.set(executionId, run);
    }
    return run;
  }

  /** Reparte un puerto libre del rango; parte de un punto distinto por ejecución para no chocar de entrada. */
  private async allocate(run: ExecutionEnv): Promise<number> {
    const [from, to] = this.config.portRange;
    const span = to - from + 1;
    const start =
      parseInt(
        createHash('sha1').update(run.tag).digest('hex').slice(0, 6),
        16,
      ) % span;
    const inUse = new Set<number>();
    for (const other of this.executions.values())
      for (const port of other.taken) inUse.add(port);
    for (let i = 0; i < span; i++) {
      const port = from + ((start + i) % span);
      if (inUse.has(port)) continue;
      if (await this.isPortFree(port)) {
        run.taken.add(port);
        return port;
      }
    }
    throw new Error('No quedan puertos libres en el rango del runner');
  }

  private async bringUp(
    run: ExecutionEnv,
    fullName: string,
    config: EnvironmentConfig,
    input: { dir: string; onLog: (line: string) => void; signal?: AbortSignal },
  ): Promise<ProjectEnv> {
    const { dir, onLog, signal } = input;
    const name = fullName.split('/')[1] ?? fullName;
    const project = `${run.tag}-${slug(name)}`;

    const ports: Record<string, number> = {};
    for (const port of config.ports)
      ports[port.name] = await this.allocate(run);

    const vars: Record<string, string> = {
      project,
      execution: run.tag,
      host: 'host.docker.internal',
    };
    for (const [key, value] of Object.entries(ports))
      vars[`port.${key}`] = String(value);

    let schema: string | undefined;
    if (config.database) {
      const service = await this.startService(
        run,
        config.database.service,
        onLog,
        signal,
      );
      vars[`service.${config.database.service}.port`] = String(service.port);
      vars['db.port'] = String(service.port);
      schema = config.database.schema;
      vars.schema = config.database.schema;
      const schemas = [
        config.database.schema,
        config.database.testSchema,
      ].filter((value): value is string => Boolean(value));
      vars.testSchema = config.database.testSchema ?? '';
      for (const each of schemas)
        await this.createSchema(run, config.database.service, each);
    }

    await this.writeFiles(fullName, name, dir, config, vars);

    const files = [...config.composeFiles];
    const overrides = config.ports.filter(
      (port) => port.service && port.container,
    );
    if (overrides.length > 0) {
      const path = join(
        this.config.workDir,
        'envs',
        run.tag,
        `${slug(name)}.override.yml`,
      );
      await mkdir(dirname(path), { recursive: true });
      const byService = new Map<string, string[]>();
      for (const port of overrides)
        byService.set(port.service!, [
          ...(byService.get(port.service!) ?? []),
          `      - "${ports[port.name]}:${port.container}"`,
        ]);
      const yaml = [
        'services:',
        ...[...byService].flatMap(([service, lines]) => [
          `  ${service}:`,
          '    ports: !override',
          ...lines,
        ]),
        '',
      ].join('\n');
      await writeFile(path, yaml);
      files.push(path);
    }

    const processEnv: Record<string, string> = {
      COMPOSE_PROJECT_NAME: project,
      COMPOSE_FILE: files.join(delimiter),
      ...(config.envFile ? { COMPOSE_ENV_FILES: config.envFile } : {}),
    };
    for (const port of config.ports)
      if (port.env) processEnv[port.env] = String(ports[port.name]);

    const env = { ...process.env, ...processEnv };
    const up = await this.exec(
      'docker',
      ['compose', ...(config.up ?? ['up', '-d', '--build'])],
      {
        cwd: dir,
        env,
        timeoutMs: 30 * 60_000,
        onLine: onLog,
        signal,
      },
    );
    if (up.code !== 0) {
      throw new Error(
        `docker compose up falló: ${tail(up.stderr || up.stdout)}`,
      );
    }

    const warnings: string[] = [];
    for (const command of config.prepare ?? []) {
      const step = await this.exec('sh', ['-c', fill(command, vars)], {
        cwd: dir,
        env,
        timeoutMs: 20 * 60_000,
        onLine: onLog,
        signal,
      });
      if (step.code !== 0) {
        warnings.push(
          `falló «${command}»: ${tail(step.stderr || step.stdout)}`,
        );
        break;
      }
    }
    for (const wait of config.waitFor ?? []) {
      const url = fill(wait.url, vars);
      if (!(await this.waitFor(url, wait.timeoutSeconds ?? 120)))
        warnings.push(`${url} no respondió a tiempo`);
    }

    await this.chown(dir);
    return { project, processEnv, ports, schema, dir, warnings };
  }

  private async startService(
    run: ExecutionEnv,
    name: string,
    onLog: (line: string) => void,
    signal?: AbortSignal,
  ) {
    const known = run.services.get(name);
    if (known) return known;
    const service = this.config.services[name];
    if (!service)
      throw new Error(
        `El servicio «${name}» no está definido en la configuración`,
      );

    const port = await this.allocate(run);
    const container = `${run.tag}-svc-${slug(name)}`;
    onLog(`Levantando ${name}…`);
    const started = await this.exec(
      'docker',
      [
        'run',
        '-d',
        '--name',
        container,
        '--label',
        `wb.exec=${run.tag}`,
        '-p',
        `${port}:${service.containerPort}`,
        ...Object.entries(service.env ?? {}).flatMap(([key, value]) => [
          '-e',
          `${key}=${value}`,
        ]),
        service.image,
        ...(service.command ?? []),
      ],
      { signal },
    );
    if (started.code !== 0)
      throw new Error(`No arrancó ${name}: ${tail(started.stderr)}`);
    const entry = { container, port };
    run.services.set(name, entry);

    for (let i = 0; i < 60; i++) {
      const ready = await this.exec(
        'docker',
        ['exec', container, ...service.ready],
        { signal },
      );
      if (ready.code === 0) return entry;
      await this.sleep(2_000);
    }
    throw new Error(`${name} no quedó listo a tiempo`);
  }

  private async createSchema(
    run: ExecutionEnv,
    serviceName: string,
    schema: string,
  ) {
    const service = this.config.services[serviceName];
    const entry = run.services.get(serviceName);
    if (!service?.createSchema || !entry) return;
    const made = await this.exec('docker', [
      'exec',
      entry.container,
      ...service.createSchema.map((arg) => fill(arg, { schema })),
    ]);
    if (made.code !== 0)
      throw new Error(
        `No se pudo crear el schema ${schema}: ${tail(made.stderr)}`,
      );
  }

  /** Copia (o arma desde una plantilla) los archivos locales del proyecto y evita que entren a un commit. */
  private async writeFiles(
    fullName: string,
    name: string,
    dir: string,
    config: EnvironmentConfig,
    vars: Record<string, string>,
  ) {
    const written: string[] = [];
    for (const file of config.files ?? []) {
      const secrets = resolve(this.config.secretsDir, name);
      const from = resolve(secrets, file.from);
      if (isAbsolute(file.from) || !from.startsWith(secrets + sep))
        throw new Error(`Ruta fuera de la carpeta de secretos: ${file.from}`);
      if (!existsSync(from))
        throw new Error(`Falta ${from} (archivo de ${fullName})`);
      const to = resolve(dir, file.to);
      if (isAbsolute(file.to) || !to.startsWith(dir + sep))
        throw new Error(`Ruta fuera del repositorio: ${file.to}`);
      await mkdir(dirname(to), { recursive: true });
      if (file.template)
        await writeFile(to, fill(await readFile(from, 'utf8'), vars));
      else await copyFile(from, to);
      written.push(file.to);
    }
    if (written.length === 0) return;
    // Lo que el repo no ignora se excluye aquí: son secretos y nunca deben llegar al commit.
    const exclude = (
      await git(['rev-parse', '--git-path', 'info/exclude'], { cwd: dir })
    ).trim();
    const path = resolve(dir, exclude);
    await mkdir(dirname(path), { recursive: true });
    const current = existsSync(path) ? await readFile(path, 'utf8') : '';
    const missing = written.filter(
      (file) => !current.split('\n').includes(`/${file}`),
    );
    if (missing.length > 0)
      await appendFile(
        path,
        `${current.endsWith('\n') || !current ? '' : '\n'}${missing.map((file) => `/${file}`).join('\n')}\n`,
      );
  }

  private async waitFor(url: string, seconds: number): Promise<boolean> {
    const deadline = Date.now() + seconds * 1000;
    for (;;) {
      try {
        if ((await this.fetchUrl(url)) < 500) return true;
      } catch {
        // todavía no responde
      }
      if (Date.now() >= deadline) return false;
      await this.sleep(3_000);
    }
  }

  /** Quita todo lo de la ejecución: los proyectos de compose, los servicios y las redes que quedaron. */
  private async down(tag: string): Promise<void> {
    const list = await this.exec('docker', [
      'ps',
      '-a',
      '--format',
      '{{.ID}}|{{.Label "com.docker.compose.project"}}|{{.Label "wb.exec"}}',
    ]);
    const ids =
      list.code === 0
        ? list.stdout
            .split('\n')
            .map((line) => line.trim().split('|'))
            .filter(
              ([id, project, exec]) =>
                id && (project?.startsWith(`${tag}-`) || exec === tag),
            )
            .map(([id]) => id)
        : [];
    if (ids.length > 0) await this.exec('docker', ['rm', '-f', '-v', ...ids]);
    await this.removeNetworks(`${tag}-`);
    await this.removeVolumes(`${tag}-`);
  }

  private async removeNetworks(prefix: string) {
    const list = await this.exec('docker', [
      'network',
      'ls',
      '--format',
      '{{.Name}}',
    ]);
    const names = list.stdout
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.startsWith(prefix));
    if (names.length > 0)
      await this.exec('docker', ['network', 'rm', ...names]);
  }

  private async removeVolumes(prefix: string) {
    const list = await this.exec('docker', [
      'volume',
      'ls',
      '--format',
      '{{.Name}}',
    ]);
    const names = list.stdout
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.startsWith(prefix));
    if (names.length > 0)
      await this.exec('docker', ['volume', 'rm', '-f', ...names]);
  }

  private notice(project: ProjectEnv): string {
    const lines = [
      '',
      '## Entorno de pruebas',
      `Este proyecto está corriendo en contenedores propios de esta ejecución (proyecto de Docker «${project.project}»). Es tu entorno local: no tiene acceso a producción.`,
      ...Object.entries(project.ports).map(
        ([name, port]) => `- ${name}: http://localhost:${port}`,
      ),
      ...(project.schema
        ? [`- Base de datos: schema «${project.schema}»`]
        : []),
      '',
      'Cómo usarlo:',
      '- `docker compose exec -T <servicio> <comando>` corre un comando dentro de un contenedor (composer, phpunit, migraciones, consola del framework). Ya apunta a tu proyecto: no necesitas `-p` ni `-f`.',
      '- `docker compose ps` / `docker compose logs <servicio>` para ver el estado; `docker compose restart <servicio>` para reiniciar (solo desarrollo).',
      '- `wb-curl <opciones> http://localhost:<puerto>/…` para probar rutas. Solo habla con localhost.',
      '- Tu código ya está montado en los contenedores: un cambio de archivo se ve sin reconstruir.',
      '- No uses `docker run`, `docker stop`, `docker rm`, `docker ps` ni toques contenedores que no sean de este proyecto.',
      ...(project.warnings.length > 0
        ? [
            '',
            'Avisos al levantarlo (puede que algo no funcione):',
            ...project.warnings.map((w) => `- ${w}`),
          ]
        : []),
      '',
      'Lo que pruebes aquí cuenta como probado. Lo que no puedas probar, dilo en tus dudas: no lo des por hecho.',
    ];
    return lines.join('\n');
  }

  private failureNotice(reason: string): string {
    return [
      '',
      '## Entorno de pruebas',
      `No se pudo levantar el entorno de este proyecto: ${reason}`,
      'Trabaja sin él y no des nada por probado que no hayas podido ejecutar; dilo en tus dudas.',
    ].join('\n');
  }
}

/** Las últimas líneas de una salida larga: ahí suele estar el motivo. */
function tail(text: string, lines = 6): string {
  return text.trim().split('\n').slice(-lines).join(' ⏎ ').slice(0, 600);
}
