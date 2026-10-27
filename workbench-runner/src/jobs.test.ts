import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { DEFAULT_CONFIG } from './config';
import type { Environments } from './environment';
import { git } from './git';
import { commitIdentity, runJob, type JobContext } from './jobs';
import {
  REPO,
  createRemote,
  createRemoteWithSubmodule,
  remoteBranches,
  tempDir,
  testConfig,
} from './test-helpers';
import type { JobKind, RunnerJob } from './types';
import { Workspaces } from './workspace';

const BRANCH = 'workbench/vista-1234abcd';

function job(kind: JobKind, tools: string[] = ['Read', 'Edit']): RunnerJob {
  return {
    id: 'job-1',
    executionId: '1234abcd-0000-0000-0000-000000000000',
    kind,
    attempt: 1,
    payload: {
      agent:
        kind === 'publish'
          ? null
          : {
              name: `agente-${kind}`,
              model: 'claude-sonnet-5-5',
              systemPrompt: 'Eres un agente',
              allowedTools: tools,
            },
      prompt:
        kind === 'tickets'
          ? 'Divide el plan en tickets'
          : kind === 'review'
            ? 'Revisas el trabajo hecho'
            : kind === 'develop'
              ? 'Estás desarrollando el ticket 1 de 1'
              : '',
      repo: REPO,
      branch: BRANCH,
      commitMessage: 'Primer ticket\n\nDetalle',
    },
  };
}

function setup() {
  const bare = createRemote();
  const config = testConfig(bare);
  const logs: string[] = [];
  const context: JobContext = {
    config,
    workspaces: new Workspaces(config.workDir, config.remoteOverrides),
    onLog: (line) => logs.push(line),
    signal: new AbortController().signal,
  };
  return { bare, config, context, logs };
}

describe('runJob', () => {
  it('tickets: answers with what the agent said, reading the repo', async () => {
    const { context } = setup();

    const outcome = await runJob(job('tickets'), context);

    assert.match(outcome.result.output ?? '', /"tickets"/);
    assert.equal(outcome.costUsd, 0.25);
  });

  it('develop: commits what the agent left and reports the commit before and after', async () => {
    const { context } = setup();

    const { result } = await runJob(job('develop'), context);

    assert.ok(result.headBefore && result.headAfter);
    assert.notEqual(result.headBefore, result.headAfter);
    assert.equal(result.output, 'Agregué feature.txt');

    const dir = join(
      context.config.workDir,
      'worktrees',
      'web__workbench__vista-1234abcd',
    );
    assert.ok(existsSync(join(dir, 'feature.txt')));
    assert.equal(
      (await git(['log', '-1', '--format=%s'], { cwd: dir })).trim(),
      'Primer ticket',
    );
    assert.equal(
      (await git(['status', '--porcelain'], { cwd: dir })).trim(),
      '',
    );
  });

  it('develop: signs the commit with the name of the agent that did the work, and «(IA)» at the end', async () => {
    const { context } = setup();
    const developer = job('develop');
    developer.payload.agent = {
      ...developer.payload.agent!,
      displayName: 'Rebecca',
    };

    await runJob(developer, context);

    const dir = join(
      context.config.workDir,
      'worktrees',
      'web__workbench__vista-1234abcd',
    );
    assert.equal(
      (await git(['log', '-1', '--format=%an|%cn'], { cwd: dir })).trim(),
      'Rebecca (IA)|Rebecca (IA)',
    );
  });

  it('develop: uses the name of the agent when it has no display name', async () => {
    const { context } = setup();

    await runJob(job('develop'), context);

    const dir = join(
      context.config.workDir,
      'worktrees',
      'web__workbench__vista-1234abcd',
    );
    assert.equal(
      (await git(['log', '-1', '--format=%an'], { cwd: dir })).trim(),
      'agente-develop (IA)',
    );
  });

  it('reports what each job spent and how the plan was going while it ran', async () => {
    const { context } = setup();

    const { usage } = await runJob(job('develop'), context);

    assert.deepEqual(usage?.tokens, {
      input: 110,
      output: 55,
      cacheWrite: 1000,
      cacheRead: 2000,
    });
    assert.equal(usage?.limits?.fiveHour?.used, 0.24);
    assert.equal(usage?.limits?.sevenDay?.used, 0.03);
  });

  it('develop: reports the same commit when the agent changed nothing', async () => {
    const { context } = setup();
    process.env.FAKE_NO_CHANGES = '1';
    try {
      const { result } = await runJob(job('develop'), context);
      assert.equal(result.headBefore, result.headAfter);
    } finally {
      delete process.env.FAKE_NO_CHANGES;
    }
  });

  it('review: discards the files that running the checks left, so they do not slip into the next commit', async () => {
    const { context, logs } = setup();
    await runJob(job('develop'), context);
    const dir = join(
      context.config.workDir,
      'worktrees',
      'web__workbench__vista-1234abcd',
    );
    const headBefore = (await git(['rev-parse', 'HEAD'], { cwd: dir })).trim();

    process.env.FAKE_TOUCH = 'dist/salida.txt,README.md';
    try {
      await runJob(job('review'), context);
    } finally {
      delete process.env.FAKE_TOUCH;
    }

    assert.equal(
      (await git(['status', '--porcelain'], { cwd: dir })).trim(),
      '',
    );
    assert.equal(existsSync(join(dir, 'dist', 'salida.txt')), false);
    assert.equal(
      (await git(['rev-parse', 'HEAD'], { cwd: dir })).trim(),
      headBefore,
    );
    assert.ok(logs.some((line) => line.includes('El revisor dejó archivos')));
  });

  it('chat: answers from the branch without changing it and discards what it leaves', async () => {
    const { context } = setup();
    await runJob(job('develop'), context);
    const dir = join(
      context.config.workDir,
      'worktrees',
      'web__workbench__vista-1234abcd',
    );
    const headBefore = (await git(['rev-parse', 'HEAD'], { cwd: dir })).trim();

    process.env.FAKE_TOUCH = 'dist/salida.txt';
    try {
      const outcome = await runJob(job('chat'), context);
      assert.ok(outcome.result.output);
      assert.equal(outcome.result.headAfter, undefined);
    } finally {
      delete process.env.FAKE_TOUCH;
    }

    assert.equal(
      (await git(['rev-parse', 'HEAD'], { cwd: dir })).trim(),
      headBefore,
    );
    assert.equal(
      (await git(['status', '--porcelain'], { cwd: dir })).trim(),
      '',
    );
  });

  it('develop: test files in the scratch folder never reach the commit and are removed afterwards', async () => {
    const { context } = setup();
    const dir = join(
      context.config.workDir,
      'worktrees',
      'web__workbench__vista-1234abcd',
    );
    process.env.FAKE_TOUCH = '.wb-scratch/x.png';
    try {
      const { result } = await runJob(job('develop'), context);
      assert.notEqual(result.headBefore, result.headAfter);
    } finally {
      delete process.env.FAKE_TOUCH;
    }

    assert.equal(existsSync(join(dir, '.wb-scratch')), false);
    const tracked = await git(['ls-files'], { cwd: dir });
    assert.ok(!tracked.includes('.wb-scratch'));
    assert.equal(
      (await git(['status', '--porcelain'], { cwd: dir })).trim(),
      '',
    );
  });

  it('final: reviews the whole branch like a review does, and discards what it leaves', async () => {
    const { context, logs } = setup();
    await runJob(job('develop'), context);
    const dir = join(
      context.config.workDir,
      'worktrees',
      'web__workbench__vista-1234abcd',
    );
    const headBefore = (await git(['rev-parse', 'HEAD'], { cwd: dir })).trim();

    process.env.FAKE_TOUCH = 'dist/salida.txt';
    try {
      const outcome = await runJob(
        { ...job('review'), kind: 'final' },
        context,
      );
      assert.ok(outcome.result.output);
      assert.equal(outcome.result.headAfter, undefined);
    } finally {
      delete process.env.FAKE_TOUCH;
    }

    assert.equal(
      (await git(['status', '--porcelain'], { cwd: dir })).trim(),
      '',
    );
    assert.equal(
      (await git(['rev-parse', 'HEAD'], { cwd: dir })).trim(),
      headBefore,
    );
    assert.ok(logs.some((line) => line.includes('El revisor dejó archivos')));
  });

  it('final: may run the checks but never edit, and has time for a whole branch', () => {
    const tools = DEFAULT_CONFIG.allowedTools.final;
    for (const command of ['test', 'run test', 'run lint', 'run build']) {
      assert.ok(tools.includes(`Bash(npm ${command}:*)` as never), command);
    }
    assert.equal(tools.includes('Edit' as never), false);
    assert.equal(tools.includes('Write' as never), false);
    assert.ok(
      DEFAULT_CONFIG.timeoutMinutes.final >
        DEFAULT_CONFIG.timeoutMinutes.review,
    );
  });

  it('review: says nothing when it left the worktree clean', async () => {
    const { context, logs } = setup();
    await runJob(job('develop'), context);

    await runJob(job('review'), context);

    assert.equal(
      logs.some((line) => line.includes('El revisor dejó archivos')),
      false,
    );
  });

  it('review: may run the tests, lint and build, but only the develop job installs', () => {
    const review = DEFAULT_CONFIG.allowedTools.review;
    for (const command of ['test', 'run test', 'run lint', 'run build']) {
      assert.ok(review.includes(`Bash(npm ${command}:*)` as never), command);
    }
    assert.equal(review.includes('Bash(npm install:*)' as never), false);
    assert.equal(review.includes('Edit' as never), false);
  });

  describe('with a submodule', () => {
    const SUBMODULE_FILE = 'src/mipedido/style.scss';

    function setupWithSubmodule() {
      const bare = createRemoteWithSubmodule();
      const config = testConfig(bare);
      const logs: string[] = [];
      const context: JobContext = {
        config,
        workspaces: new Workspaces(config.workDir, config.remoteOverrides),
        onLog: (line) => logs.push(line),
        signal: new AbortController().signal,
      };
      const dir = join(
        config.workDir,
        'worktrees',
        'web__workbench__vista-1234abcd',
      );
      return { context, logs, dir };
    }

    it('develop: discards what the agent changed inside it and commits the rest', async () => {
      const { context, logs, dir } = setupWithSubmodule();
      process.env.FAKE_TOUCH = SUBMODULE_FILE;
      try {
        const { result } = await runJob(job('develop'), context);
        assert.notEqual(result.headBefore, result.headAfter);
      } finally {
        delete process.env.FAKE_TOUCH;
      }

      assert.equal(
        (await git(['status', '--porcelain'], { cwd: dir })).trim(),
        '',
      );
      assert.equal(
        readFileSync(join(dir, SUBMODULE_FILE), 'utf8'),
        '.a { color: blue; }\n',
      );
      assert.ok(logs.some((line) => line.includes('submódulos')));
    });

    it('develop: reports no changes instead of failing when only the submodule changed', async () => {
      const { context, dir } = setupWithSubmodule();
      process.env.FAKE_TOUCH = SUBMODULE_FILE;
      process.env.FAKE_NO_CHANGES = '1';
      try {
        const { result } = await runJob(job('develop'), context);
        assert.equal(result.headBefore, result.headAfter);
      } finally {
        delete process.env.FAKE_TOUCH;
        delete process.env.FAKE_NO_CHANGES;
      }
      assert.equal(
        (await git(['status', '--porcelain'], { cwd: dir })).trim(),
        '',
      );
    });

    it('discards what an earlier attempt left in it before the agent starts', async () => {
      const { context, logs, dir } = setupWithSubmodule();
      await runJob(job('review'), context);
      writeFileSync(join(dir, SUBMODULE_FILE), 'sobras\n');

      await runJob(job('review'), context);

      assert.equal(
        readFileSync(join(dir, SUBMODULE_FILE), 'utf8'),
        '.a { color: blue; }\n',
      );
      assert.ok(
        logs.some((line) => line.includes('quedado en los submódulos')),
      );
    });

    it('tells the agent not to touch it', async () => {
      const { context } = setupWithSubmodule();
      const argsFile = join(tempDir('args'), 'args.json');
      process.env.FAKE_CLAUDE_ARGS_FILE = argsFile;
      try {
        await runJob(job('develop'), context);
      } finally {
        delete process.env.FAKE_CLAUDE_ARGS_FILE;
      }

      const { prompt } = JSON.parse(readFileSync(argsFile, 'utf8')) as {
        prompt: string;
      };
      assert.match(prompt, /Submódulos de este repositorio/);
      assert.match(prompt, /- src\/mipedido/);
      assert.match(prompt, /NO las modifiques/);
    });
  });

  it('review: runs after develop on the same branch and sees its work', async () => {
    const { context } = setup();
    await runJob(job('develop'), context);

    const argsFile = join(tempDir('args'), 'args.json');
    process.env.FAKE_CLAUDE_ARGS_FILE = argsFile;
    try {
      const { result } = await runJob(job('review'), context);
      assert.match(result.output ?? '', /approved/);
    } finally {
      delete process.env.FAKE_CLAUDE_ARGS_FILE;
    }

    const seen = JSON.parse(readFileSync(argsFile, 'utf8')) as { cwd: string };
    assert.ok(existsSync(join(seen.cwd, 'feature.txt')));
  });

  describe('with a test environment', () => {
    /** Un entorno de mentira: anota qué se le pidió y entrega lo que se le diga. */
    function fakeEnvironments(up = true) {
      const events: string[] = [];
      const environments = {
        async ensure() {
          events.push('ensure');
          return up
            ? {
                notice: '## Entorno de pruebas — Arriba',
                processEnv: { COMPOSE_PROJECT_NAME: 'wb-12345678-web' },
              }
            : {
                notice: '## Entorno de pruebas — No se pudo',
                processEnv: {},
              };
        },
        async reclaim() {
          events.push('reclaim');
        },
        async tearDown() {
          events.push('tearDown');
        },
      } as unknown as Environments;
      return { environments, events };
    }

    async function run(kind: JobKind, up = true) {
      const { context } = setup();
      const { environments, events } = fakeEnvironments(up);
      const argsFile = join(tempDir('args'), 'args.json');
      process.env.FAKE_CLAUDE_ARGS_FILE = argsFile;
      try {
        await runJob(job(kind), { ...context, environments });
      } finally {
        delete process.env.FAKE_CLAUDE_ARGS_FILE;
      }
      const seen = JSON.parse(readFileSync(argsFile, 'utf8')) as {
        args: string[];
        prompt: string;
        compose: string | null;
      };
      return {
        events,
        seen,
        tools: seen.args[seen.args.indexOf('--allowedTools') + 1],
      };
    }

    it('develop: tells the agent about it, runs it in its Docker project and lets it use its containers', async () => {
      const { seen, tools, events } = await run('develop');

      assert.match(seen.prompt, /Entorno de pruebas — Arriba/);
      assert.equal(seen.compose, 'wb-12345678-web');
      assert.ok(tools.includes('Bash(docker compose exec:*)'));
      assert.ok(tools.includes('Bash(docker compose restart:*)'));
      assert.ok(!tools.includes('Bash(docker:*)'));
      assert.deepEqual(events, ['ensure', 'reclaim']);
    });

    it('review: gets it too, without restarting services', async () => {
      const { tools } = await run('review');
      assert.ok(tools.includes('Bash(docker compose exec:*)'));
      assert.ok(!tools.includes('Bash(docker compose restart:*)'));
    });

    it('the final review is the last user of the environment and takes it down', async () => {
      const { events } = await run('final');
      assert.deepEqual(events, ['ensure', 'reclaim', 'tearDown']);
    });

    it('chat: on a running execution it gets the environment and leaves it for the next job', async () => {
      const { context } = setup();
      const { environments, events } = fakeEnvironments();
      await runJob(job('develop'), context);

      await runJob(job('chat'), { ...context, environments });

      assert.deepEqual(events, ['ensure', 'reclaim']);
    });

    it('chat: on a finished execution it rebuilds what it needs and leaves it for the next question', async () => {
      const { context } = setup();
      const { environments, events } = fakeEnvironments();
      const dir = join(
        context.config.workDir,
        'worktrees',
        'web__workbench__vista-1234abcd',
      );

      await runJob(job('chat'), { ...context, environments });

      assert.deepEqual(events, ['ensure', 'reclaim']);
      assert.ok(existsSync(dir));
    });

    it('chat: reads the environment like a review and never restarts anything', async () => {
      const { tools } = await run('chat');
      assert.ok(tools.includes('Bash(docker compose exec:*)'));
      assert.ok(tools.includes('Bash(wb-curl:*)'));
      assert.ok(!tools.includes('Bash(docker compose restart:*)'));
    });

    it('tickets: Lucy gets it too, read-only, and leaves it up for the developer', async () => {
      const { events, seen, tools } = await run('tickets');
      assert.deepEqual(events, ['ensure', 'reclaim']);
      assert.equal(seen.compose, 'wb-12345678-web');
      assert.ok(tools.includes('Bash(docker compose exec:*)'));
      assert.ok(!tools.includes('Bash(docker compose restart:*)'));
    });

    it('when it could not be brought up the agent works without containers and is told so', async () => {
      const { seen, tools } = await run('develop', false);
      assert.match(seen.prompt, /No se pudo/);
      assert.equal(seen.compose, null);
      assert.ok(!tools.includes('Bash(docker compose exec:*)'));
    });

    it('publish: gives the files back, removes the worktree and then takes the environment down', async () => {
      const { context } = setup();
      await runJob(job('develop'), context);
      const { environments, events } = fakeEnvironments();

      await runJob(job('publish'), { ...context, environments });

      assert.deepEqual(events, ['reclaim', 'tearDown']);
    });
  });

  it('gives the agent only the tools that the server asks for and this runner allows', async () => {
    const { context, logs } = setup();
    const argsFile = join(tempDir('args'), 'args.json');
    process.env.FAKE_CLAUDE_ARGS_FILE = argsFile;
    try {
      await runJob(
        job('develop', ['Read', 'Edit', 'Bash(rm:*)', 'Bash(git push:*)']),
        context,
      );
    } finally {
      delete process.env.FAKE_CLAUDE_ARGS_FILE;
    }

    const { args } = JSON.parse(readFileSync(argsFile, 'utf8')) as {
      args: string[];
    };
    assert.equal(args[args.indexOf('--allowedTools') + 1], 'Read,Edit');
    assert.ok(
      logs.some(
        (line) =>
          line.includes('Bash(rm:*)') && line.includes('Bash(git push:*)'),
      ),
    );
  });

  it('publish: pushes the branch and reports the base branch', async () => {
    const { context, bare } = setup();
    await runJob(job('develop'), context);

    const outcome = await runJob(job('publish'), context);
    const { result } = outcome;

    assert.equal(result.baseBranch, 'main');
    assert.ok(remoteBranches(bare).includes(BRANCH));
    // Al subir la rama se mide cómo va el plan: es lo último de una ejecución.
    assert.equal(outcome.usage?.limits?.fiveHour?.used, 0.24);
    // La carpeta de trabajo se libera: ya no hace falta.
    assert.equal(
      existsSync(
        join(
          context.config.workDir,
          'worktrees',
          'web__workbench__vista-1234abcd',
        ),
      ),
      false,
    );
  });

  describe('with other repositories to read', () => {
    const OTHER = {
      sshUrl: 'git@bitbucket.org:acme/app.git',
      fullName: 'acme/app',
      branch: BRANCH,
    };

    function twoRepos() {
      const web = createRemote();
      const config = testConfig(web, {
        remoteOverrides: { 'acme/web': web, 'acme/app': createRemote() },
      });
      const logs: string[] = [];
      const context: JobContext = {
        config,
        workspaces: new Workspaces(config.workDir, config.remoteOverrides),
        onLog: (line) => logs.push(line),
        signal: new AbortController().signal,
      };
      return { context, logs };
    }

    function withContext(kind: JobKind): RunnerJob {
      const result = job(kind);
      result.payload.context = [OTHER];
      result.payload.prompt += ' lee {{dir:acme/app}}';
      return result;
    }

    async function run(context: JobContext, kind: JobKind) {
      const argsFile = join(tempDir('args'), 'args.json');
      process.env.FAKE_CLAUDE_ARGS_FILE = argsFile;
      try {
        await runJob(withContext(kind), context);
      } finally {
        delete process.env.FAKE_CLAUDE_ARGS_FILE;
      }
      return JSON.parse(readFileSync(argsFile, 'utf8')) as {
        args: string[];
        cwd: string;
        prompt: string;
      };
    }

    it('opens the other repository on its own worktree and lets the agent see it', async () => {
      const { context } = twoRepos();

      const seen = await run(context, 'develop');

      const dir = seen.args[seen.args.indexOf('--add-dir') + 1];
      assert.ok(dir.endsWith('app__workbench__vista-1234abcd'));
      assert.ok(existsSync(join(dir, 'README.md')));
      // El agente trabaja en el repo del ticket, no en el de consulta.
      assert.ok(seen.cwd.endsWith('web__workbench__vista-1234abcd'));
      assert.ok(seen.prompt.includes(`lee ${dir}`));
      assert.ok(!seen.prompt.includes('{{dir:'));
    });

    it('does not add folders when the task has a single repository', async () => {
      const { context } = setup();
      const argsFile = join(tempDir('args'), 'args.json');
      process.env.FAKE_CLAUDE_ARGS_FILE = argsFile;
      try {
        await runJob(job('develop'), context);
      } finally {
        delete process.env.FAKE_CLAUDE_ARGS_FILE;
      }

      const { args } = JSON.parse(readFileSync(argsFile, 'utf8')) as {
        args: string[];
      };
      assert.ok(!args.includes('--add-dir'));
    });

    describe('the chat of Lucy', () => {
      /** Solo `acme/app` tiene entorno; `acme/web`, el principal, no. */
      function onlyTheOtherHasOne() {
        const asked: string[] = [];
        const events: string[] = [];
        const environments = {
          async ensure(input: { repo: { fullName: string }; dir: string }) {
            asked.push(input.repo.fullName);
            if (input.repo.fullName !== 'acme/app') return null;
            return {
              notice: '## Entorno de pruebas — Arriba',
              processEnv: { COMPOSE_PROJECT_NAME: 'wb-12345678-app' },
            };
          },
          async reclaim() {
            events.push('reclaim');
          },
          async tearDown() {
            events.push('tearDown');
          },
        } as unknown as Environments;
        return { environments, asked, events };
      }

      it('brings up the environment of the other repository, so its dependencies are there to read', async () => {
        const { context } = twoRepos();
        const { environments, asked } = onlyTheOtherHasOne();
        const argsFile = join(tempDir('args'), 'args.json');
        process.env.FAKE_CLAUDE_ARGS_FILE = argsFile;
        try {
          await runJob(withContext('chat'), { ...context, environments });
        } finally {
          delete process.env.FAKE_CLAUDE_ARGS_FILE;
        }

        assert.deepEqual(asked, ['acme/web', 'acme/app']);
        const seen = JSON.parse(readFileSync(argsFile, 'utf8')) as {
          prompt: string;
          compose: string | null;
        };
        assert.match(seen.prompt, /Entorno de pruebas — Arriba/);
        assert.equal(seen.compose, 'wb-12345678-app');
      });

      it('leaves what it built in the other repository for the next question', async () => {
        const { context } = twoRepos();
        const { environments, events } = onlyTheOtherHasOne();

        await runJob(withContext('chat'), { ...context, environments });

        assert.ok(!events.includes('tearDown'));
        const other = join(
          context.config.workDir,
          'worktrees',
          'app__workbench__vista-1234abcd',
        );
        assert.equal(existsSync(other), true);
      });

      it('leaves the other repository alone when it was already there', async () => {
        const { context } = twoRepos();
        const { environments, events } = onlyTheOtherHasOne();
        await context.workspaces.prepare(REPO, BRANCH);
        const other = await context.workspaces.prepare(OTHER, OTHER.branch);

        await runJob(withContext('chat'), { ...context, environments });

        assert.ok(!events.includes('tearDown'));
        assert.ok(existsSync(other.dir));
      });
    });

    it('throws away what the agent changed in a repository that is only to read', async () => {
      const { context, logs } = twoRepos();
      const other = await context.workspaces.prepare(OTHER, OTHER.branch);
      writeFileSync(join(other.dir, 'intruso.txt'), 'no debería estar\n');

      await run(context, 'develop');

      assert.equal(existsSync(join(other.dir, 'intruso.txt')), false);
      assert.ok(logs.some((line) => line.includes('solo de consulta')));
    });
  });

  it('fails with the message of the agent and its cost', async () => {
    const { context } = setup();
    process.env.FAKE_FAIL = '1';
    try {
      await assert.rejects(runJob(job('develop'), context), /Sin crédito/);
    } finally {
      delete process.env.FAKE_FAIL;
    }
  });

  it('fails a job that comes without an agent when it needs one', async () => {
    const { context } = setup();
    const broken = job('develop');
    broken.payload.agent = null;

    await assert.rejects(runJob(broken, context), /agente/);
  });
});

describe('commitIdentity', () => {
  it('adds «(IA)» once, cleans the name and falls back to the ordinary identity without an agent', () => {
    assert.deepEqual(commitIdentity({ name: 'x', displayName: ' David ' }), {
      GIT_AUTHOR_NAME: 'David (IA)',
      GIT_COMMITTER_NAME: 'David (IA)',
    });
    assert.equal(
      commitIdentity({ name: 'Kiwi (IA)' }).GIT_AUTHOR_NAME,
      'Kiwi (IA)',
    );
    assert.equal(
      commitIdentity({ name: 'Mal <nombre>\n' }).GIT_AUTHOR_NAME,
      'Mal nombre (IA)',
    );
    assert.deepEqual(commitIdentity(null), {});
  });
});
