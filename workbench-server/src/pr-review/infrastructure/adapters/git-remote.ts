import { ConfigService } from '@nestjs/config';
import type { MirrorRemote } from '@core/git/repo-mirror';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export interface RemoteUrls {
  /** URL con el token, solo para clonar o traer cambios: nunca se guarda en el repo. */
  cloneUrl: string;
  /** URL sin credenciales: la que queda como `origin`. */
  cleanUrl: string;
  secret: string;
}

export function remoteUrls(
  config: ConfigService,
  pullRequest: PullRequest,
): RemoteUrls {
  if (pullRequest.provider === 'bitbucket') {
    const token = config.getOrThrow<string>('BITBUCKET_TOKEN');
    return {
      cloneUrl: `https://x-bitbucket-api-token-auth:${encodeURIComponent(token)}@bitbucket.org/${pullRequest.repo}.git`,
      cleanUrl: `https://bitbucket.org/${pullRequest.repo}.git`,
      secret: token,
    };
  }

  const token = config.getOrThrow<string>('GITHUB_TOKEN');
  return {
    cloneUrl: `https://x-access-token:${encodeURIComponent(token)}@github.com/${pullRequest.repo}.git`,
    cleanUrl: `https://github.com/${pullRequest.repo}.git`,
    secret: token,
  };
}

/** De dónde se trae el repo de la PR al mirror compartido: `host/organización/repo` identifica el mirror. */
export function mirrorRemote(
  config: ConfigService,
  pullRequest: PullRequest,
): MirrorRemote {
  const host =
    pullRequest.provider === 'bitbucket' ? 'bitbucket.org' : 'github.com';
  return {
    key: `${host}/${pullRequest.repo}`,
    ...remoteUrls(config, pullRequest),
  };
}

/** Los nombres vienen del autor de la PR: no deben poder inyectar opciones de git. */
export function assertSafeRemote(pullRequest: PullRequest): void {
  if (!REPO_PATTERN.test(pullRequest.repo)) {
    throw new Error(`Unsafe repository name: ${pullRequest.repo}`);
  }
  for (const branch of [pullRequest.sourceBranch, pullRequest.destBranch]) {
    const hasControlChar = [...branch].some((c) => c.charCodeAt(0) < 32);
    if (branch.startsWith('-') || /\s/.test(branch) || hasControlChar) {
      throw new Error(`Unsafe branch name: ${branch}`);
    }
  }
}
