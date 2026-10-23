import { DomainError } from '@core/domain/domain.error';
import { ExecutionRepo } from './entities/execution.props';

const HOSTS = ['github.com', 'bitbucket.org'];
const SEGMENT = /^[\w.-]+$/;

/**
 * El repositorio de una etiqueta (`https://<host>/<organización>/<repo>`) con la dirección SSH por la
 * que el runner clona y sube la rama. Lo que llega al runner no puede traer opciones de git.
 */
export function parseRepo(url: string): ExecutionRepo {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DomainError(`The repository link is not valid: ${url}`);
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.protocol !== 'https:' || !HOSTS.includes(parsed.hostname)) {
    throw new DomainError(
      `The repository must be on github.com or bitbucket.org: ${url}`,
    );
  }
  if (parts.length !== 2) {
    throw new DomainError(`The repository link is not valid: ${url}`);
  }

  const organization = parts[0];
  const name = parts[1].replace(/\.git$/, '');
  const valid = (segment: string) =>
    SEGMENT.test(segment) && !segment.startsWith('-') && !/^\.+$/.test(segment);
  if (!valid(organization) || !valid(name)) {
    throw new DomainError(`The repository name has invalid characters: ${url}`);
  }

  return {
    url: `https://${parsed.hostname}/${organization}/${name}`,
    host: parsed.hostname,
    fullName: `${organization}/${name}`,
    sshUrl: `git@${parsed.hostname}:${organization}/${name}.git`,
  };
}

const MAX_SLUG = 40;

/** Nombre de la rama de una ejecución: legible y siempre válido para git. */
export function branchNameFor(taskName: string, executionId: string): string {
  const slug = taskName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');

  return `workbench/${slug || 'task'}-${executionId.slice(0, 8)}`;
}
