import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  RepositoryCheckout,
  RepositoryCheckoutPort,
} from '@pr-review/domain/ports/repository-checkout.port';

const GIT_TIMEOUT_MS = 5 * 60 * 1000;
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/**
 * Clona el repo de la PR en un directorio temporal y deja la rama de la PR en
 * checkout. El token solo se usa para el clone: el remoto queda sin credenciales
 * para que el agente no pueda leerlo desde .git/config.
 */
@Injectable()
export class GitCliCheckoutAdapter implements RepositoryCheckoutPort {
  constructor(private readonly config: ConfigService) {}

  async checkout(pullRequest: PullRequest): Promise<RepositoryCheckout> {
    this.assertSafe(pullRequest);

    const workdir = await mkdtemp(join(tmpdir(), 'prrev-'));
    const dest = join(workdir, 'repo');
    const dispose = () => rm(workdir, { recursive: true, force: true });

    try {
      const { cloneUrl, cleanUrl, secret } = this.urls(pullRequest);

      await this.git(['clone', '--quiet', '--no-checkout', cloneUrl, dest], {
        secret,
      });
      await this.git(['remote', 'set-url', 'origin', cleanUrl], {
        cwd: dest,
        secret,
      });
      await this.git(
        [
          'checkout',
          '--quiet',
          '--detach',
          `origin/${pullRequest.sourceBranch}`,
        ],
        { cwd: dest, secret },
      );
      const commit = (
        await this.git(['rev-parse', 'HEAD'], { cwd: dest, secret })
      ).trim();

      return { path: dest, commit, dispose };
    } catch (error) {
      await dispose().catch(() => undefined);
      throw error;
    }
  }

  private urls(pullRequest: PullRequest) {
    if (pullRequest.provider === 'bitbucket') {
      const token = this.config.getOrThrow<string>('BITBUCKET_TOKEN');
      return {
        cloneUrl: `https://x-bitbucket-api-token-auth:${encodeURIComponent(token)}@bitbucket.org/${pullRequest.repo}.git`,
        cleanUrl: `https://bitbucket.org/${pullRequest.repo}.git`,
        secret: token,
      };
    }

    const token = this.config.getOrThrow<string>('GITHUB_TOKEN');
    return {
      cloneUrl: `https://x-access-token:${encodeURIComponent(token)}@github.com/${pullRequest.repo}.git`,
      cleanUrl: `https://github.com/${pullRequest.repo}.git`,
      secret: token,
    };
  }

  /** Los nombres vienen del autor de la PR: no deben poder inyectar opciones de git. */
  private assertSafe(pullRequest: PullRequest): void {
    if (!REPO_PATTERN.test(pullRequest.repo)) {
      throw new Error(`Unsafe repository name: ${pullRequest.repo}`);
    }
    for (const branch of [pullRequest.sourceBranch, pullRequest.destBranch]) {
      const hasControlChar = [...branch].some((c) => c.charCodeAt(0) < 32);
      if (branch.startsWith('-') || /\s/.test(branch) || hasControlChar) {
        throw new Error(`Unsafe branch name: ${branch}`);
      }
    }
  }

  private git(
    args: string[],
    options: { cwd?: string; secret: string },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd: options.cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`git ${args[0]} timed out`));
      }, GIT_TIMEOUT_MS);

      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        reject(
          new Error(
            err.code === 'ENOENT'
              ? 'git is not installed'
              : `Could not run git: ${err.message}`,
          ),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
          return;
        }
        const clean = stderr
          .split(options.secret)
          .join('***')
          .split(encodeURIComponent(options.secret))
          .join('***');
        reject(new Error(`git ${args[0]} failed: ${clean.trim()}`));
      });
    });
  }
}
