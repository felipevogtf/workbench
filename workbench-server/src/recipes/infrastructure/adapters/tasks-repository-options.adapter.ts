import { Injectable } from '@nestjs/common';
import { TasksFacade } from '@tasks/application/tasks-facade.service';
import { normalizeRepoName } from '@recipes/domain/entities/recipe.entity';
import {
  RepositoryOption,
  RepositoryOptionsPort,
} from '@recipes/domain/ports/repository-options.port';

/** Único punto de las recetas que conoce al módulo tasks: de sus etiquetas salen los repositorios que se ofrecen. */
@Injectable()
export class TasksRepositoryOptionsAdapter implements RepositoryOptionsPort {
  constructor(private readonly tasks: TasksFacade) {}

  async list(): Promise<RepositoryOption[]> {
    const byRepo = new Map<string, string[]>();
    for (const label of await this.tasks.findAllLabels()) {
      const repo = repoOf(label.repoUrl);
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

/** `https://host/org/repo` → `org/repo`; `null` si no es un enlace de repositorio. */
function repoOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts.length === 2
      ? normalizeRepoName(`${parts[0]}/${parts[1].replace(/\.git$/, '')}`)
      : null;
  } catch {
    return null;
  }
}
