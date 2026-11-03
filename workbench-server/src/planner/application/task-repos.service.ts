import { Inject, Injectable } from '@nestjs/common';
import {
  REPOS_CACHE_PORT,
  type CachedRepos,
  type ReposCachePort,
} from '@planner/domain/ports/repos-cache.port';
import {
  TASKS_GATEWAY_PORT,
  type TasksGatewayPort,
} from '@planner/domain/ports/tasks-gateway.port';
import { MAX_REPOS_PER_PLAN, repoUrlsOf } from '@planner/domain/task-repos';

/**
 * Los repos de las etiquetas de una tarea, ya clonados y al día (rama principal, solo lectura). Es la
 * misma caché que usan el plan y el chat de la tarea; sirve para que otros módulos lean el código sin
 * volver a clonarlo.
 */
@Injectable()
export class TaskReposService {
  constructor(
    @Inject(TASKS_GATEWAY_PORT)
    private readonly tasks: TasksGatewayPort,
    @Inject(REPOS_CACHE_PORT)
    private readonly repos: ReposCachePort,
  ) {}

  /**
   * `null` si la tarea no existe. Con `repoUrls` se clonan esos repos en vez de los de las etiquetas (una ejecución puede
   * haber sumado alguno que la tarea no tiene), hasta el mismo máximo.
   */
  async ensure(
    issueId: string,
    repoUrls?: readonly string[],
  ): Promise<CachedRepos | null> {
    const task = await this.tasks.getTask(issueId);
    if (!task) return null;
    return this.repos.ensure(
      issueId,
      repoUrls
        ? [...new Set(repoUrls)].slice(0, MAX_REPOS_PER_PLAN)
        : repoUrlsOf(task),
    );
  }
}
