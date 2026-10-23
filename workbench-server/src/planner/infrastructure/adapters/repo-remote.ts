import { ConfigService } from '@nestjs/config';

/** Ramas que se prueban, en este orden, al clonar el repositorio de una etiqueta. */
export const REPO_BRANCHES = ['main', 'master'];

const HOSTS = ['github.com', 'bitbucket.org'];
const SEGMENT = /^[\w.-]+$/;

export interface ParsedRepo {
  host: string;
  organization: string;
  name: string;
}

export interface RepoCredentials {
  /** URL con el token, solo para clonar o traer cambios: nunca se guarda en el repo. */
  cloneUrl: string;
  /** URL sin credenciales: la que queda como `origin`. */
  cleanUrl: string;
  secret: string;
}

/** Defensa en profundidad: aunque la etiqueta ya validó el enlace, aquí se vuelve a comprobar. */
export function parseRepoUrl(url: string): ParsedRepo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (
    parsed.protocol !== 'https:' ||
    !HOSTS.includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parts.length !== 2
  ) {
    return null;
  }

  const [organization, name] = [parts[0], parts[1].replace(/\.git$/, '')];
  const valid = (segment: string) =>
    SEGMENT.test(segment) && !segment.startsWith('-') && !/^\.+$/.test(segment);
  return valid(organization) && valid(name)
    ? { host: parsed.hostname, organization, name }
    : null;
}

/** El nombre del repo; si ya hay otro igual (de otra organización), con la organización delante. */
export function repoFolderName(repo: ParsedRepo, taken: Set<string>): string {
  return taken.has(repo.name) ? `${repo.organization}-${repo.name}` : repo.name;
}

/** Las URLs de acceso del repo, o null si no hay token configurado para su proveedor. */
export function repoCredentials(
  config: ConfigService,
  repo: ParsedRepo,
): RepoCredentials | null {
  const path = `${repo.organization}/${repo.name}.git`;
  if (repo.host === 'bitbucket.org') {
    const token = config.get<string>('BITBUCKET_TOKEN');
    return token
      ? {
          cloneUrl: `https://x-bitbucket-api-token-auth:${encodeURIComponent(token)}@bitbucket.org/${path}`,
          cleanUrl: `https://bitbucket.org/${path}`,
          secret: token,
        }
      : null;
  }

  const token = config.get<string>('GITHUB_TOKEN');
  return token
    ? {
        cloneUrl: `https://x-access-token:${encodeURIComponent(token)}@github.com/${path}`,
        cleanUrl: `https://github.com/${path}`,
        secret: token,
      }
    : null;
}
