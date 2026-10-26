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

/** Cómo empieza el nombre de la rama: según de qué trata la tarea. */
export const BRANCH_TYPES = ['feature', 'fix', 'hotfix'] as const;
export type BranchType = (typeof BRANCH_TYPES)[number];

const HOTFIX_WORDS = /\bhotfix\b/;
const FIX_WORDS =
  /\b(fix|bugfix|bug|error|errores|corregir|corrige|correccion|arreglar|arregla|arreglo|falla|fallo|fallas)\b/;

/**
 * El tipo de rama que corresponde a una tarea, por su nombre: «hotfix» si lo dice, «fix» si habla de corregir un error y
 * «feature» en cualquier otro caso. Es una suposición sobre el título (Plane no guarda aquí un tipo de tarea): el usuario
 * puede elegir otro al ejecutar.
 */
export function branchTypeOf(taskName: string): BranchType {
  const words = taskName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (HOTFIX_WORDS.test(words)) return 'hotfix';
  return FIX_WORDS.test(words) ? 'fix' : 'feature';
}

/** La parte legible del nombre de la rama: el nombre de la tarea, en minúsculas y sin caracteres raros. */
function slugOf(taskName: string): string {
  return (
    taskName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG)
      .replace(/-+$/g, '') || 'task'
  );
}

/**
 * Nombre de la rama de una ejecución, legible y siempre válido para git:
 * - `feature/vista-de-ordenes` para una tarea local;
 * - `feature/MEL-12/vista-de-ordenes` cuando la tarea viene de Plane, con el código de su ticket;
 * - el tipo es `feature`, `fix` o `hotfix`.
 * Una tarea que se ejecuta otra vez no puede repetir la rama (la anterior sigue en el remoto con su PR): desde la segunda
 * ejecución lleva `-2`, `-3`…
 */
export function branchNameFor(data: {
  taskName: string;
  type: BranchType;
  /** El código del ticket de Plane (`MEL-12`); `null` en una tarea local. */
  key?: string | null;
  /** Cuántas ejecuciones lleva la tarea, contando esta (la primera es 1). */
  attempt?: number;
}): string {
  const key = data.key?.replace(/[^A-Za-z0-9_-]/g, '');
  const attempt = data.attempt && data.attempt > 1 ? `-${data.attempt}` : '';
  return [data.type, key, `${slugOf(data.taskName)}${attempt}`]
    .filter(Boolean)
    .join('/');
}
