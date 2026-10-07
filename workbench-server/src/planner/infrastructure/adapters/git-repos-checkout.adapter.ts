import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runGit } from '@core/git/run-git';
import { PlanRepoInfo } from '@planner/domain/entities/plan.props';
import {
  ReposCheckout,
  ReposCheckoutPort,
} from '@planner/domain/ports/repos-checkout.port';

const BRANCHES = ['main', 'master'];
const HOSTS = ['github.com', 'bitbucket.org'];
const SEGMENT = /^[\w.-]+$/;

interface ParsedRepo {
  host: string;
  organization: string;
  name: string;
}

/**
 * Clona repositorios en un directorio temporal, superficialmente y de solo lectura: rama `main` o,
 * si no existe, `master`. El token solo se usa durante el clone: el remoto queda sin credenciales
 * para que el agente no pueda leerlas desde `.git/config`.
 */
@Injectable()
export class GitReposCheckoutAdapter implements ReposCheckoutPort {
  constructor(private readonly config: ConfigService) {}

  async checkout(repoUrls: string[]): Promise<ReposCheckout> {
    const workdir = await mkdtemp(join(tmpdir(), 'plan-'));
    const dispose = () => rm(workdir, { recursive: true, force: true });

    try {
      const repos: PlanRepoInfo[] = [];
      const folders = new Set<string>();

      for (const url of repoUrls) {
        const parsed = this.parse(url);
        if (!parsed) {
          repos.push({
            url,
            name: '',
            used: false,
            note: 'enlace de repositorio no válido',
          });
          continue;
        }

        const name = this.folderName(parsed, folders);
        folders.add(name);
        repos.push(await this.cloneOne(url, parsed, join(workdir, name), name));
      }

      return { path: workdir, repos, dispose };
    } catch (error) {
      await dispose().catch(() => undefined);
      throw error;
    }
  }

  private async cloneOne(
    url: string,
    parsed: ParsedRepo,
    dest: string,
    name: string,
  ): Promise<PlanRepoInfo> {
    const credentials = this.credentials(parsed);
    if (!credentials) {
      return {
        url,
        name,
        used: false,
        note: `no hay token configurado para ${parsed.host}`,
      };
    }

    for (const branch of BRANCHES) {
      try {
        await runGit(
          [
            'clone',
            '--quiet',
            '--depth',
            '1',
            '--branch',
            branch,
            credentials.cloneUrl,
            dest,
          ],
          { secrets: [credentials.secret] },
        );
        await runGit(['remote', 'set-url', 'origin', credentials.cleanUrl], {
          cwd: dest,
          secrets: [credentials.secret],
        });
        return { url, name, used: true, note: null };
      } catch {
        // Esa rama no existe (o no hay acceso): se prueba la siguiente.
        await rm(dest, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    return {
      url,
      name,
      used: false,
      note: 'no se pudo clonar: no existe la rama main ni master, o no hay acceso',
    };
  }

  /** Defensa en profundidad: aunque la etiqueta ya validó el enlace, aquí se vuelve a comprobar. */
  private parse(url: string): ParsedRepo | null {
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
      SEGMENT.test(segment) &&
      !segment.startsWith('-') &&
      !/^\.+$/.test(segment);
    return valid(organization) && valid(name)
      ? { host: parsed.hostname, organization, name }
      : null;
  }

  /** El nombre del repo; si ya hay otro igual (de otra organización), con la organización delante. */
  private folderName(repo: ParsedRepo, taken: Set<string>): string {
    return taken.has(repo.name)
      ? `${repo.organization}-${repo.name}`
      : repo.name;
  }

  private credentials(
    repo: ParsedRepo,
  ): { cloneUrl: string; cleanUrl: string; secret: string } | null {
    const path = `${repo.organization}/${repo.name}.git`;
    if (repo.host === 'bitbucket.org') {
      const token = this.config.get<string>('BITBUCKET_TOKEN');
      return token
        ? {
            cloneUrl: `https://x-bitbucket-api-token-auth:${encodeURIComponent(token)}@bitbucket.org/${path}`,
            cleanUrl: `https://bitbucket.org/${path}`,
            secret: token,
          }
        : null;
    }

    const token = this.config.get<string>('GITHUB_TOKEN');
    return token
      ? {
          cloneUrl: `https://x-access-token:${encodeURIComponent(token)}@github.com/${path}`,
          cleanUrl: `https://github.com/${path}`,
          secret: token,
        }
      : null;
  }
}
