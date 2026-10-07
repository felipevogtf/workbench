import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runGit } from '@core/git/run-git';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  RepositoryCheckout,
  RepositoryCheckoutPort,
} from '@pr-review/domain/ports/repository-checkout.port';

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
    return runGit(args, { cwd: options.cwd, secrets: [options.secret] });
  }
}
