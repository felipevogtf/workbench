import { TaskContext } from './ports/tasks-gateway.port';

/** Máximo de repositorios que se clonan por plan (acota el tiempo y el disco). */
export const MAX_REPOS_PER_PLAN = 3;

/** Repositorios de las etiquetas (sin repetidos, por nombre de etiqueta), hasta el máximo. */
export function repoUrlsOf(task: TaskContext): string[] {
  const urls = [...task.labels]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .flatMap((label) => (label.repoUrl ? [label.repoUrl] : []));
  return [...new Set(urls)].slice(0, MAX_REPOS_PER_PLAN);
}
