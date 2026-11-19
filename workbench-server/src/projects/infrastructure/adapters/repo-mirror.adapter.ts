import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepoMirrorService } from '@core/git/repo-mirror';
import {
  mirrorKeyOf,
  parseRepoUrl,
  repoCredentials,
} from '@core/git/repo-remote';
import { RepositoryMirrorPort } from '@projects/domain/ports/repository-mirror.port';

/** Único punto de los proyectos que conoce el clon compartido del servidor. */
@Injectable()
export class RepoMirrorAdapter implements RepositoryMirrorPort {
  private readonly logger = new Logger(RepoMirrorAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mirror: RepoMirrorService,
  ) {}

  async prepare(repoUrl: string): Promise<void> {
    const parsed = parseRepoUrl(repoUrl);
    const credentials = parsed && repoCredentials(this.config, parsed);
    const key = mirrorKeyOf(repoUrl);
    if (!credentials || !key) return;
    try {
      await this.mirror.sync({ key, ...credentials });
    } catch (error) {
      this.logger.warn(
        `Could not prepare the mirror of ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async discard(repoUrl: string): Promise<void> {
    const key = mirrorKeyOf(repoUrl);
    if (!key) return;
    try {
      await this.mirror.discard(key);
    } catch (error) {
      this.logger.warn(
        `Could not remove the mirror of ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
