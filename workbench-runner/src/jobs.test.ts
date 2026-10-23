import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { git } from './git';
import { runJob, type JobContext } from './jobs';
import {
  REPO,
  createRemote,
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
      'workbench__vista-1234abcd',
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

    const { result } = await runJob(job('publish'), context);

    assert.equal(result.baseBranch, 'main');
    assert.ok(remoteBranches(bare).includes(BRANCH));
    // La carpeta de trabajo se libera: ya no hace falta.
    assert.equal(
      existsSync(
        join(context.config.workDir, 'worktrees', 'workbench__vista-1234abcd'),
      ),
      false,
    );
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
