import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type RunnerConfig } from './config';

/** Los commits de las pruebas necesitan una identidad, la tenga o no el PC. */
Object.assign(process.env, {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  // Un submódulo que vive en una carpeta local: git lo rechaza salvo que se permita el protocolo file.
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'protocol.file.allow',
  GIT_CONFIG_VALUE_0: 'always',
});

export const FAKE_CLAUDE = join(
  __dirname,
  '..',
  'test-support',
  'fake-claude.js',
);

export function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `wbr-${prefix}-`));
}

const run = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' });

/** Un remoto local (bare) con un commit en `main`, para clonar y empujar sin red. */
export function createRemote(): string {
  const root = tempDir('remote');
  const bare = join(root, 'web.git');
  const seed = join(root, 'seed');
  mkdirSync(seed);

  run(root, 'init', '--bare', '--initial-branch=main', bare);
  run(seed, 'init', '--initial-branch=main');
  writeFileSync(join(seed, 'README.md'), '# web\n');
  run(seed, 'add', '--all');
  run(seed, 'commit', '-m', 'inicio');
  run(seed, 'remote', 'add', 'origin', bare);
  run(seed, 'push', 'origin', 'main');
  run(bare, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  return bare;
}

/** Un remoto como el de `createRemote`, pero con `src/mipedido` como submódulo (otro repositorio). */
export function createRemoteWithSubmodule(): string {
  const bare = createRemote();
  const root = tempDir('submodule');
  const subBare = join(root, 'mipedido.git');
  const seed = join(root, 'seed');
  mkdirSync(seed);
  run(root, 'init', '--bare', '--initial-branch=main', subBare);
  run(seed, 'init', '--initial-branch=main');
  writeFileSync(join(seed, 'style.scss'), '.a { color: blue; }\n');
  run(seed, 'add', '--all');
  run(seed, 'commit', '-m', 'estilos');
  run(seed, 'remote', 'add', 'origin', subBare);
  run(seed, 'push', 'origin', 'main');

  const work = join(root, 'work');
  run(root, 'clone', bare, work);
  run(work, 'submodule', 'add', subBare, 'src/mipedido');
  run(work, 'commit', '-m', 'agrega el submódulo');
  run(work, 'push', 'origin', 'main');
  return bare;
}

export function remoteBranches(bare: string): string[] {
  return run(bare, 'branch', '--format=%(refname:short)')
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);
}

export const REPO = {
  sshUrl: 'git@bitbucket.org:acme/web.git',
  fullName: 'acme/web',
};

/** Configuración de prueba: el repo `acme/web` sale del remoto local y Claude es el de mentira. */
export function testConfig(
  bare: string,
  overrides: Partial<RunnerConfig> = {},
): RunnerConfig {
  return {
    serverUrl: 'http://localhost:1/api',
    token: 'wbr_test',
    workDir: tempDir('work'),
    claudeBin: process.execPath,
    claudeBinArgs: [FAKE_CLAUDE],
    maxBudgetUsd: 5,
    timeoutMinutes: { ...DEFAULT_CONFIG.timeoutMinutes },
    allowedTools: {
      tickets: [...DEFAULT_CONFIG.allowedTools.tickets],
      develop: [...DEFAULT_CONFIG.allowedTools.develop],
      review: [...DEFAULT_CONFIG.allowedTools.review],
      final: [...DEFAULT_CONFIG.allowedTools.final],
    },
    remoteOverrides: { 'acme/web': bare },
    copyFiles: {},
    environment: {
      secretsDir: tempDir('secrets'),
      portRange: [20000, 29999],
      idleMinutes: 120,
      services: {},
      environments: {},
    },
    ...overrides,
  };
}
