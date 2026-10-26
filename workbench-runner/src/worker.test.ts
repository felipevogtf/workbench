import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { ServerApi } from './api';
import { Worker, scrub } from './worker';
import { REPO, createRemote, testConfig } from './test-helpers';
import type { RunnerJob } from './types';
import { Workspaces } from './workspace';

interface Call {
  path: string;
  auth: string | undefined;
  body: any;
}

/** Un servidor de mentira con las rutas del runner: entrega los trabajos que se le den, una vez cada uno. */
let askToProbe = false;

async function fakeServer(jobs: RunnerJob[]) {
  const calls: Call[] = [];
  const queue = [...jobs];
  const server: Server = createServer((request: IncomingMessage, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += chunk));
    request.on('end', () => {
      const path = (request.url ?? '').replace('/api', '');
      calls.push({
        path,
        auth: request.headers.authorization,
        body: raw ? JSON.parse(raw) : {},
      });

      const json = (value: unknown, status = 200) => {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(value));
      };
      if (path === '/runner/jobs/claim') {
        const next = queue.shift();
        if (next) return json(next);
        // Sin trabajo: el servidor real esperaría ~25 s; aquí poco.
        return setTimeout(() => {
          response.writeHead(204);
          response.end();
        }, 100);
      }
      if (path === '/runner/heartbeat')
        return json({ stop: [], probe: askToProbe });
      if (path.endsWith('/logs')) return json({ ok: true });
      if (path.endsWith('/result')) {
        response.writeHead(204);
        return response.end();
      }
      return json({});
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return {
    calls,
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function developJob(): RunnerJob {
  return {
    id: 'job-aaaa-1111',
    executionId: '1234abcd-0000-0000-0000-000000000000',
    kind: 'develop',
    attempt: 1,
    payload: {
      agent: {
        name: 'dev',
        model: 'm',
        systemPrompt: 's',
        allowedTools: ['Read', 'Edit'],
      },
      prompt: 'Estás desarrollando el ticket 1 de 1',
      repo: REPO,
      branch: 'workbench/vista-1234abcd',
      commitMessage: 'Ticket',
    },
  };
}

async function waitFor(condition: () => boolean, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) throw new Error('Se agotó la espera');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('Worker', () => {
  it('introduces itself, does the job it is given and delivers the result with its token', async () => {
    const server = await fakeServer([developJob()]);
    const config = testConfig(createRemote(), {
      serverUrl: server.url,
      token: 'wbr_secreto',
    });
    const worker = new Worker(
      new ServerApi(server.url, config.token),
      config,
      new Workspaces(config.workDir, config.remoteOverrides),
      () => undefined,
    );

    const running = worker.run();
    await waitFor(() =>
      server.calls.some((call) => call.path.endsWith('/result')),
    );
    worker.stop();
    await running;
    await server.close();

    assert.equal(server.calls[0].path, '/runner/hello');
    assert.ok(server.calls.every((call) => call.auth === 'Bearer wbr_secreto'));

    const result = server.calls.find(
      (call) => call.path === '/runner/jobs/job-aaaa-1111/result',
    )!;
    assert.equal(result.body.ok, true);
    assert.equal(result.body.costUsd, 0.25);
    assert.notEqual(
      result.body.result.headBefore,
      result.body.result.headAfter,
    );

    const logs = server.calls
      .filter((call) => call.path.endsWith('/logs'))
      .map((call) => call.body.text as string)
      .join('');
    assert.match(logs, /Voy a mirar el repositorio/);
    assert.match(logs, /→ Read src\/index\.ts/);
  });

  it('reports a failed job with its error instead of dying', async () => {
    const server = await fakeServer([developJob()]);
    const config = testConfig(createRemote(), { serverUrl: server.url });
    process.env.FAKE_FAIL = '1';
    const worker = new Worker(
      new ServerApi(server.url, config.token),
      config,
      new Workspaces(config.workDir, config.remoteOverrides),
      () => undefined,
      200,
    );

    try {
      const running = worker.run();
      await waitFor(() =>
        server.calls.some((call) => call.path.endsWith('/result')),
      );
      worker.stop();
      await running;
    } finally {
      delete process.env.FAKE_FAIL;
      await server.close();
    }

    const result = server.calls.find((call) => call.path.endsWith('/result'))!;
    assert.equal(result.body.ok, false);
    assert.match(result.body.error, /Sin crédito/);
    assert.equal(result.body.costUsd, 0.01);
  });

  it('measures how the plan is going when the server asks for it with the heartbeat, and reports it', async () => {
    askToProbe = true;
    const server = await fakeServer([]);
    const config = testConfig(createRemote(), {
      serverUrl: server.url,
      token: 'wbr_secreto',
    });
    const worker = new Worker(
      new ServerApi(server.url, config.token),
      config,
      new Workspaces(config.workDir, config.remoteOverrides),
      () => undefined,
      200,
    );
    const running = worker.run();

    try {
      await waitFor(
        () => server.calls.some((call) => call.path === '/runner/usage'),
        10_000,
      ).catch(() => {
        throw new Error(
          'No informó el plan. Llamadas: ' +
            server.calls.map((call) => call.path).join(', '),
        );
      });

      const report = server.calls.find(
        (call) => call.path === '/runner/usage',
      )!;
      assert.equal(report.body.limits.fiveHour.used, 0.24);
      assert.ok(report.body.tokens.input > 0);
    } finally {
      askToProbe = false;
      worker.stop();
      await running;
      await server.close();
    }
  });
});

describe('scrub', () => {
  it('hides credentials before the log leaves the PC', () => {
    assert.equal(scrub('clave sk-ant-api03-abcdefghijk fin'), 'clave *** fin');
    assert.equal(scrub('token wbr_abcdefghijk'), 'token ***');
    assert.equal(
      scrub('git clone https://usuario:clave@bitbucket.org/a/b.git'),
      'git clone https://***@bitbucket.org/a/b.git',
    );
    assert.equal(scrub('nada que ocultar'), 'nada que ocultar');
  });
});
