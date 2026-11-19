import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepoMirrorService } from '@core/git/repo-mirror';
import { runGit } from '@core/git/run-git';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import {
  RepositoryCheckout,
  RepositoryCheckoutPort,
} from '@pr-review/domain/ports/repository-checkout.port';
import { assertSafeRemote, mirrorRemote } from './git-remote';

const RULES_FILE = 'REVIEW_RULES.md';

/**
 * Deja la rama de la PR en un worktree desechable, sacado del mirror compartido del repo: no clona el repositorio cada vez, solo trae
 * lo nuevo. A diferencia del chat, la revisión exige lo último del proveedor (no se revisa código viejo). El worktree no tiene
 * credenciales: el token solo se usa para traer los cambios al mirror.
 */
@Injectable()
export class GitCliCheckoutAdapter implements RepositoryCheckoutPort {
  constructor(
    private readonly config: ConfigService,
    private readonly mirror: RepoMirrorService,
  ) {}

  async checkout(pullRequest: PullRequest): Promise<RepositoryCheckout> {
    assertSafeRemote(pullRequest);

    const workdir = await mkdtemp(join(tmpdir(), 'prrev-'));
    const dest = join(workdir, 'repo');
    let mirrorPath: string | undefined;
    const dispose = async () => {
      if (mirrorPath) await this.mirror.removeWorktree(mirrorPath, dest);
      await rm(workdir, { recursive: true, force: true });
    };

    try {
      const mirror = await this.mirror.sync(
        mirrorRemote(this.config, pullRequest),
        { requireFresh: true },
      );
      mirrorPath = mirror.path;
      await this.mirror.addWorktree(
        mirror.path,
        dest,
        pullRequest.sourceBranch,
      );
      const commit = await this.mirror.head(dest);
      const rules = await this.loadRules(pullRequest, dest);

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
  ): Promise<string | null> {
    for (const ref of [`origin/${pullRequest.destBranch}`, 'HEAD']) {
      try {
        const text = await runGit(['show', `${ref}:${RULES_FILE}`], { cwd });
        if (text.trim()) return text.trim();
      } catch {
        // sin archivo en esa rama: se prueba la siguiente
      }
    }
    return null;
  }
}
