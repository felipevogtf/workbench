import { Injectable } from '@nestjs/common';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import {
  RepositoryOption,
  RepositoryOptionsPort,
} from '@projects/domain/ports/repository-options.port';

/** Único punto de las recetas que conoce al módulo tasks: de sus etiquetas salen los repositorios que se ofrecen. */
@Injectable()
export class TasksRepositoryOptionsAdapter implements RepositoryOptionsPort {
  constructor(private readonly tasks: TasksFacade) {}

  async list(): Promise<RepositoryOption[]> {
    const byRepo = new Map<string, string[]>();
    for (const label of await this.tasks.findAllLabels()) {
      const repo = label.projectRepo;
      if (!repo) continue;
      byRepo.set(repo, [...(byRepo.get(repo) ?? []), label.name]);
    }
    return [...byRepo]
      .map(([repo, labels]) => ({
        repo,
        labels: labels.sort((a, b) => a.localeCompare(b, 'es')),
      }))
      .sort((a, b) => a.repo.localeCompare(b.repo));
  }
}
