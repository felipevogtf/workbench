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
import { assertSafeRemote, remoteUrls } from './git-remote';

const RULES_FILE = 'REVIEW_RULES.md';

/**
 * Clona el repo de la PR en un directorio temporal y deja la rama de la PR en
 * checkout. El token solo se usa para el clone: el remoto queda sin credenciales
 * para que el agente no pueda leerlo desde .git/config.
 */
@Injectable()
export class GitCliCheckoutAdapter implements RepositoryCheckoutPort {
  constructor(private readonly config: ConfigService) {}

  async checkout(pullRequest: PullRequest): Promise<RepositoryCheckout> {
    assertSafeRemote(pullRequest);

    const workdir = await mkdtemp(join(tmpdir(), 'prrev-'));
    const dest = join(workdir, 'repo');
    const dispose = () => rm(workdir, { recursive: true, force: true });

    try {
      const { cloneUrl, cleanUrl, secret } = remoteUrls(
        this.config,
        pullRequest,
      );

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

      const rules = await this.loadRules(pullRequest, dest, secret);

      return { path: dest, commit, rules, dispose };
    } catch (error) {
      await dispose().catch(() => undefined);
      throw error;
    }
  }

  /**
   * Las reglas se leen de la rama destino, para que una PR no pueda cambiar las reglas con que se
   * la revisa; si esa rama aún no las tiene, se usan las de la rama de la PR. Nunca bloquea la revisión.
   */
  private async loadRules(
    pullRequest: PullRequest,
    cwd: string,
    secret: string,
  ): Promise<string | null> {
    for (const ref of [`origin/${pullRequest.destBranch}`, 'HEAD']) {
      try {
        const text = await this.git(['show', `${ref}:${RULES_FILE}`], {
          cwd,
          secret,
        });
        if (text.trim()) return text.trim();
      } catch {
        // sin archivo en esa rama: se prueba la siguiente
      }
    }
    return null;
  }

  private git(
    args: string[],
    options: { cwd?: string; secret: string },
  ): Promise<string> {
    return runGit(args, { cwd: options.cwd, secrets: [options.secret] });
  }
}
