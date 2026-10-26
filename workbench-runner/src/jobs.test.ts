import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { git } from './git';
import { runJob, type JobContext } from './jobs';
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
