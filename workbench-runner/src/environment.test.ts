import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, it } from 'node:test';
import {
  Environments,
  type EnvironmentConfig,
  type EnvironmentsConfig,
  type Exec,
  environmentTools,
  fill,
} from './environment';
import { createRemote, tempDir } from './test-helpers';
import { Workspaces } from './workspace';

const REPO = { fullName: 'acme/web', sshUrl: 'git@bitbucket.org:acme/web.git' };

const WEB: EnvironmentConfig = {
  composeFiles: ['docker-compose.yml', 'docker-compose-wiremock.yml'],
  envFile: '.env.docker.local',
  ports: [
    { name: 'app', env: 'COMPOSE_PORT' },
    { name: 'wiremock', service: 'wiremock', container: 8080 },
  ],
  database: { service: 'mysql', schema: 'web', testSchema: 'web-test' },
  files: [
    { from: 'env.docker.local', to: '.env.docker.local', template: true },
    { from: 'private.pem', to: 'config/jwt/private.pem' },
  ],
  prepare: ['docker compose exec -T app composer install'],
  waitFor: [{ url: 'http://localhost:{{port.app}}/' }],
};

function setup(
  config: Partial<EnvironmentsConfig> = {},
  environments: Record<string, EnvironmentConfig> = { 'acme/web': WEB },
) {
  const calls: {
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  }[] = [];
  const containers: string[] = [];
  let fail: ((args: string[]) => boolean) | null = null;
  const exec: Exec = async (command, args, options) => {
    calls.push({ command, args, env: options?.env, cwd: options?.cwd });
    if (fail?.(args)) return { code: 1, stdout: '', stderr: 'boom' };
    // `docker ps` devuelve lo que se haya «levantado»
    if (command === 'docker' && args[0] === 'ps')
      return { code: 0, stdout: containers.join('\n'), stderr: '' };
    return { code: 0, stdout: '', stderr: '' };
  };
  const workDir = tempDir('envwork');
  const secretsDir = tempDir('secrets');
  mkdirSync(join(secretsDir, 'web'), { recursive: true });
  writeFileSync(
    join(secretsDir, 'web', 'env.docker.local'),
    'COMPOSE_PORT={{port.app}}\nDB={{host}}:{{db.port}}/{{schema}}\nP={{project}}\n',
  );
  writeFileSync(join(secretsDir, 'web', 'private.pem'), 'KEY');
  const busy = new Set<number>();
  const environments_ = new Environments(
    {
      workDir,
      secretsDir,
      portRange: [30000, 30099],
      idleMinutes: 120,
      services: {
        mysql: {
          image: 'mysql:5.7',
          containerPort: 3306,
          env: { MYSQL_ROOT_PASSWORD: 'root' },
          ready: ['mysqladmin', 'ping'],
          createSchema: [
            'mysql',
            '-uroot',
            '-e',
            'CREATE DATABASE IF NOT EXISTS `{{schema}}`',
          ],
        },
      },
      environments,
      ...config,
    },
    exec,
    async (port) => !busy.has(port),
    async () => undefined,
    async () => 200,
  );
  return {
    env: environments_,
    calls,
    containers,
    busy,
    workDir,
    failOn: (f: (args: string[]) => boolean) => (fail = f),
  };
}

async function worktree() {
  const bare = createRemote();
  const work = new Workspaces(tempDir('ws'), { 'acme/web': bare });
  const { dir } = await work.prepare(REPO, 'feature/x');
  return dir;
}

describe('fill', () => {
  it('replaces the values and rejects the ones that do not exist', () => {
    assert.equal(
      fill('a {{x}} b {{ y.z }}', { x: '1', 'y.z': '2' }),
      'a 1 b 2',
    );
    assert.throws(() => fill('{{nope}}', {}), /nope/);
  });
});

describe('environmentTools', () => {
  it('lets the developer restart services but not the reviewer, and gives nothing to the planner', () => {
    assert.ok(
      environmentTools('develop').includes('Bash(docker compose restart:*)'),
    );
    assert.ok(
      !environmentTools('review').includes('Bash(docker compose restart:*)'),
    );
    assert.ok(environmentTools('final').includes('Bash(wb-curl:*)'));
    assert.deepEqual(environmentTools('tickets'), environmentTools('review'));
  });

  it('never allows a free docker', () => {
    for (const kind of ['develop', 'review', 'final'] as const)
      for (const tool of environmentTools(kind))
        assert.ok(
          /^Bash\((docker compose (exec|ps|logs|restart)|wb-curl):\*\)$/.test(
            tool,
          ),
          tool,
        );
  });
});

describe('Environments', () => {
  it('does nothing for a repo without configuration or turned off', async () => {
    const { env, calls } = setup(
      {},
      { 'acme/web': { ...WEB, enabled: false } },
    );
    const dir = await worktree();
    assert.equal(
      await env.ensure({ executionId: 'e1', repo: REPO, dir, onLog: () => {} }),
      null,
    );
    assert.equal(
      await setup({}, {}).env.ensure({
        executionId: 'e1',
        repo: REPO,
        dir,
        onLog: () => {},
      }),
      null,
    );
    assert.equal(calls.length, 0);
  });

  it('brings the project up with its own name and ports, prepares it and tells the agent', async () => {
    const { env, calls, workDir } = setup();
    const dir = await worktree();
    const logs: string[] = [];

    const handle = await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: (l) => logs.push(l),
    });

    assert.ok(handle);
    const up = calls.find(
      (c) => c.args[0] === 'compose' && c.args[1] === 'up',
    )!;
    const project = up.env!.COMPOSE_PROJECT_NAME!;
    assert.match(project, /^wb-[0-9a-f]{8}-web$/);
    assert.equal(up.cwd, dir);
    const files = up.env!.COMPOSE_FILE!.split(delimiter);
    assert.deepEqual(files.slice(0, 2), [
      'docker-compose.yml',
      'docker-compose-wiremock.yml',
    ]);
    assert.match(files[2], /web\.override\.yml$/);
    assert.equal(up.env!.COMPOSE_ENV_FILES, '.env.docker.local');
    const appPort = Number(up.env!.COMPOSE_PORT);
    assert.ok(appPort >= 30000 && appPort <= 30099);

    // la base: un contenedor propio, con puerto publicado, y los dos schemas
    const run = calls.find((c) => c.args[0] === 'run')!;
    assert.ok(run.args.includes('mysql:5.7'));
    assert.ok(run.args.some((a) => /^3\d{4}:3306$/.test(a)));
    assert.equal(
      calls.filter((c) => c.args[0] === 'exec' && c.args.includes('mysql'))
        .length,
      2,
    );

    // un puerto que el compose fija a mano se reemplaza con un archivo extra
    const override = readFileSync(
      up.env!.COMPOSE_FILE!.split(delimiter).pop()!,
      'utf8',
    );
    assert.match(
      override,
      /wiremock:\n {4}ports: !override\n {6}- "3\d{4}:8080"/,
    );

    // los archivos locales: plantilla con los valores de esta ejecución, y copia tal cual
    const envFile = readFileSync(join(dir, '.env.docker.local'), 'utf8');
    assert.ok(envFile.includes(`COMPOSE_PORT=${appPort}`));
    assert.match(envFile, /DB=host\.docker\.internal:3\d{4}\/web/);
    assert.ok(envFile.includes(`P=${project}`));
    assert.equal(
      readFileSync(join(dir, 'config', 'jwt', 'private.pem'), 'utf8'),
      'KEY',
    );
    // y quedan fuera de cualquier commit
    const exclude = readFileSync(
      join(dir, '..', '..', 'repos', 'acme__web', '.git', 'info', 'exclude'),
      'utf8',
    );
    assert.ok(
      exclude.includes('/.env.docker.local') &&
        exclude.includes('/config/jwt/private.pem'),
    );

    assert.ok(
      calls.some(
        (c) =>
          c.command === 'sh' &&
          c.args[1] === 'docker compose exec -T app composer install',
      ),
    );
    assert.match(handle.notice, new RegExp(`app: http://localhost:${appPort}`));
    assert.match(handle.notice, /schema «web»/);
    assert.equal(handle.processEnv.COMPOSE_PROJECT_NAME, project);
    // wb-curl queda primero en el PATH del agente
    assert.ok(handle.processEnv.PATH!.startsWith(join(workDir, 'bin')));
    assert.ok(existsSync(join(workDir, 'bin', 'wb-curl')));
    assert.ok(logs.includes('Entorno arriba'));
  });

  it('reuses the environment for the next jobs of the same execution', async () => {
    const { env, calls } = setup();
    const dir = await worktree();
    const input = { executionId: 'exec-1', repo: REPO, dir, onLog: () => {} };
    const first = await env.ensure(input);
    const second = await env.ensure(input);
    assert.equal(
      calls.filter((c) => c.args[0] === 'compose' && c.args[1] === 'up').length,
      1,
    );
    assert.equal(
      second!.processEnv.COMPOSE_PROJECT_NAME,
      first!.processEnv.COMPOSE_PROJECT_NAME,
    );
  });

  it('restarts the services when a later job reuses the environment, so mounted files edited in place are read again', async () => {
    const { env, calls } = setup();
    const dir = await worktree();
    const logs: string[] = [];
    const input = {
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: (line: string) => logs.push(line),
    };
    const restarts = () =>
      calls.filter((c) => c.args[0] === 'compose' && c.args[1] === 'restart');

    await env.ensure(input);
    assert.equal(restarts().length, 0, 'the first job just brought it up');

    await env.ensure(input);
    assert.equal(restarts().length, 1);
    assert.equal(
      restarts()[0].env?.COMPOSE_PROJECT_NAME?.startsWith('wb-'),
      true,
    );
    assert.ok(logs.some((line) => line.includes('Reiniciando los servicios')));
  });

  it('gives each execution its own project name and different ports', async () => {
    const { env, calls } = setup();
    const dir = await worktree();
    await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    await env.ensure({
      executionId: 'exec-2',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    const ups = calls.filter(
      (c) => c.args[0] === 'compose' && c.args[1] === 'up',
    );
    assert.notEqual(
      ups[0].env!.COMPOSE_PROJECT_NAME,
      ups[1].env!.COMPOSE_PROJECT_NAME,
    );
    assert.notEqual(ups[0].env!.COMPOSE_PORT, ups[1].env!.COMPOSE_PORT);
  });

  it('skips ports that are busy on this PC', async () => {
    const { env, calls, busy } = setup({ portRange: [30000, 30009] });
    for (let port = 30000; port <= 30005; port++) busy.add(port);
    const dir = await worktree();
    await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    const up = calls.find((c) => c.args[1] === 'up')!;
    assert.ok(Number(up.env!.COMPOSE_PORT) >= 30006);
  });

  it('works without the environment when it cannot be brought up, and cleans what was left', async () => {
    const { env, calls, failOn } = setup();
    failOn((args) => args[0] === 'compose' && args[1] === 'up');
    const dir = await worktree();
    const logs: string[] = [];

    const handle = await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: (l) => logs.push(l),
    });

    assert.deepEqual(handle!.processEnv, {});
    assert.match(handle!.notice, /No se pudo levantar el entorno/);
    assert.match(handle!.notice, /no des nada por probado/);
    assert.ok(
      calls.some((c) => c.args[0] === 'network' && c.args[1] === 'ls'),
      'limpió',
    );
    // y no lo reintenta en cada trabajo
    const before = calls.length;
    await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    assert.equal(calls.length, before);
  });

  it('tries `up` a second time when the first one fails, since builds sometimes collide', async () => {
    const { env, calls, failOn } = setup();
    let ups = 0;
    failOn((args) => args[0] === 'compose' && args[1] === 'up' && ++ups === 1);
    const dir = await worktree();

    const handle = await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });

    assert.ok(handle!.processEnv.COMPOSE_PROJECT_NAME, 'quedó arriba');
    assert.equal(
      calls.filter((c) => c.args[0] === 'compose' && c.args[1] === 'up').length,
      2,
    );
  });

  it('retries a preparation step once, since other containers can collide with it', async () => {
    const { env, calls, failOn } = setup();
    let tries = 0;
    failOn((args) => args[0] === '-c' && ++tries === 1);
    const dir = await worktree();

    const handle = await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });

    assert.doesNotMatch(handle!.notice, /Avisos al levantarlo/);
    assert.equal(calls.filter((c) => c.command === 'sh').length, 2);
  });

  it('keeps going, with a warning, when a preparation step fails', async () => {
    const { env, failOn } = setup();
    // los pasos de preparación van por `sh -c`
    failOn((args) => args[0] === '-c');
    const dir = await worktree();
    const handle = await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    assert.ok(
      handle!.processEnv.COMPOSE_PROJECT_NAME,
      'el entorno sigue disponible',
    );
    assert.match(handle!.notice, /Avisos al levantarlo/);
    assert.match(
      handle!.notice,
      /falló «docker compose exec -T app composer install»/,
    );
  });

  it('removes every container, network and volume of the execution and nothing else', async () => {
    const { env, calls, containers } = setup();
    const dir = await worktree();
    await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    const project = calls.find((c) => c.args[1] === 'up')!.env!
      .COMPOSE_PROJECT_NAME!;
    const tag = project.replace(/-web$/, '');
    containers.push(
      `aaa|${project}.app|${project}|`,
      `bbb|${tag}-svc-mysql||${tag}`,
      `ccc|miflota-db||`,
      `ddd|other.app|other|`,
    );
    calls.length = 0;

    await env.tearDown('exec-1');

    const removal = calls.find((c) => c.args[0] === 'rm')!;
    assert.deepEqual(removal.args, ['rm', '-f', '-v', 'aaa', 'bbb']);
    assert.ok(calls.some((c) => c.args[0] === 'network' && c.args[1] === 'ls'));
    assert.ok(calls.some((c) => c.args[0] === 'volume' && c.args[1] === 'ls'));
    assert.ok(calls.some((c) => c.args[0] === 'images'));
  });

  it('removes the orphans of a previous run when it starts, only the ones with its mark', async () => {
    const { env, calls, containers } = setup();
    containers.push(
      'aaa|wb-1234abcd-web.app|wb-1234abcd-web|',
      'bbb|wb-1234abcd-svc-mysql||wb-1234abcd',
      'ccc|miflota-db||',
    );
    const removed = await env.sweepOrphans();
    assert.equal(removed, 2);
    assert.deepEqual(calls.find((c) => c.args[0] === 'rm')!.args, [
      'rm',
      '-f',
      '-v',
      'aaa',
      'bbb',
    ]);
  });

  it('takes down the environments nobody has used for a while', async () => {
    const { env } = setup();
    const dir = await worktree();
    await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    assert.deepEqual(await env.sweepIdle(Date.now() + 60 * 60_000), []);
    assert.deepEqual(await env.sweepIdle(Date.now() + 3 * 60 * 60_000), [
      'exec-1',
    ]);
    assert.deepEqual(await env.sweepIdle(Date.now() + 9 * 60 * 60_000), []);
  });

  it('only reads files from the secrets folder of the project', async () => {
    const { env } = setup(
      {},
      { 'acme/web': { ...WEB, files: [{ from: '../other/x', to: 'x' }] } },
    );
    const dir = await worktree();
    const handle = await env.ensure({
      executionId: 'exec-1',
      repo: REPO,
      dir,
      onLog: () => {},
    });
    assert.match(handle!.notice, /Ruta fuera de la carpeta de secretos/);
    assert.equal(existsSync(join(dir, 'x')), false);
  });
});
