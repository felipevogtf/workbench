#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { ServerApi } from './api';
import { loadConfig } from './config';
import { VERSION, Worker } from './worker';
import { Workspaces } from './workspace';

/** `node dist/main.js check`: comprueba lo que el runner necesita antes de dejarlo trabajando. */
async function check(): Promise<number> {
  let problems = 0;
  const ok = (message: string) => console.log(`  ✔ ${message}`);
  const bad = (message: string) => {
    problems++;
    console.log(`  ✖ ${message}`);
  };

  const config = loadConfig();
  ok(`configuración leída (${config.serverUrl})`);

  const tool = (name: string, args: string[], hint: string) => {
    const result = spawnSync(name, args, { encoding: 'utf8' });
    if (result.error || result.status !== 0)
      bad(`${name} no responde. ${hint}`);
    else
      ok(`${name}: ${(result.stdout || result.stderr).split('\n')[0].trim()}`);
  };
  tool('git', ['--version'], 'Instala Git for Windows');
  tool(
    config.claudeBin,
    ['--version'],
    'Instala Claude Code o configura claudeBin',
  );

  const identity = spawnSync('git', ['config', 'user.email'], {
    encoding: 'utf8',
  });
  if (identity.stdout.trim())
    ok(`git firma los commits como ${identity.stdout.trim()}`);
  else
    bad(
      'git no tiene user.email: `git config --global user.email "tu@correo"` (los commits lo necesitan)',
    );

  await mkdir(config.workDir, { recursive: true });
  ok(`carpeta de trabajo: ${config.workDir}`);

  try {
    await new ServerApi(config.serverUrl, config.token).hello({
      version: VERSION,
      host: 'check',
    });
    ok('el servidor acepta el token');
  } catch (error) {
    bad(`no se pudo hablar con el servidor: ${(error as Error).message}`);
  }

  console.log(
    problems === 0
      ? '\nTodo listo. Lánzalo con: npm start'
      : `\n${problems} problema(s) por resolver.`,
  );
  return problems === 0 ? 0 : 1;
}

async function main(): Promise<number> {
  if (process.argv[2] === 'check') return check();

  const config = loadConfig();
  await mkdir(config.workDir, { recursive: true });

  const workspaces = new Workspaces(config.workDir, config.remoteOverrides);
  const removed = await workspaces.sweep();
  if (removed.length > 0)
    console.log(
      `Se borraron ${removed.length} carpeta(s) de trabajo abandonadas`,
    );

  const worker = new Worker(
    new ServerApi(config.serverUrl, config.token),
    config,
    workspaces,
  );
  const stop = () => {
    console.log('\nDeteniendo…');
    worker.stop();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  console.log(
    `workbench-runner ${VERSION} · carpeta de trabajo ${config.workDir}`,
  );
  await worker.run();
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
