import { Injectable, Logger } from '@nestjs/common';
import { TaskReposService } from '@planner/application/task-repos.service';
import {
  ReadableRepo,
  RepositoriesGatewayPort,
} from '@executions/domain/ports/gateways.port';

/** Único punto de la ejecución que lee la caché de repos del planificador. */
@Injectable()
export class RepositoriesGatewayAdapter implements RepositoriesGatewayPort {
  private readonly logger = new Logger(RepositoriesGatewayAdapter.name);

  constructor(private readonly repos: TaskReposService) {}

  async ensure(
    issueId: string,
  ): Promise<{ path: string; repos: ReadableRepo[] } | null> {
    try {
      const cached = await this.repos.ensure(issueId);
      if (!cached) return null;
      return {
        path: cached.path,
        repos: cached.repos.map((repo) => ({
          url: repo.url,
          folder: repo.name,
          used: repo.used,
          note: repo.note,
        })),
      };
    } catch (error) {
      // Sin el código Lucy sigue contestando con el estado de la ejecución.
      this.logger.warn(
        `Could not read the repositories of the task: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
