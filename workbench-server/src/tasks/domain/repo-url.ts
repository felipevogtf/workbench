import { DomainError } from '@core/domain/domain.error';

const HOSTS = ['github.com', 'bitbucket.org'];
const SEGMENT = /^[\w.-]+$/;

/**
 * Valida y normaliza el enlace de un repositorio: solo github.com o bitbucket.org, con la forma
 * `https://<host>/<organizacion>/<repo>`. Sin credenciales, sin puerto y sin `.git` final. Lo que
 * llega a un clone no puede traer opciones de git ni credenciales embebidas.
 */
export function normalizeRepoUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new DomainError('The repository link is not a valid URL');
  }

  if (
    url.protocol !== 'https:' ||
    !HOSTS.includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new DomainError(
      'The repository must be an https link to github.com or bitbucket.org, without credentials',
    );
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new DomainError(
      'The repository link must look like https://github.com/<organization>/<repository>',
    );
  }
  const [organization, name] = [parts[0], parts[1].replace(/\.git$/, '')];
  if (
    !SEGMENT.test(organization) ||
    !SEGMENT.test(name) ||
    organization.startsWith('-') ||
    name.startsWith('-') ||
    name === '.' ||
    name === '..'
  ) {
    throw new DomainError('The repository name has invalid characters');
  }

  return `https://${url.hostname}/${organization}/${name}`;
}
