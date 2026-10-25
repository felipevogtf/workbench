import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  GithubComment,
  GithubPullRequest,
  GithubSearchItem,
  GithubSearchResponse,
} from './github-api.types';

const API = 'https://api.github.com';
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_FILE_BYTES = 3_000_000;

/** Cada tramo de la ruta se codifica por separado para conservar las barras. */
const encodePath = (path: string) =>
  path.split('/').map(encodeURIComponent).join('/');

@Injectable()
export class GithubApiClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.get('GITHUB_TOKEN'));
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.config.getOrThrow<string>('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'workbench-server',
    };
  }

  /** PRs abiertas con una solicitud de review pendiente para el usuario del token. */
  searchReviewRequested(): Promise<GithubSearchItem[]> {
    return this.search('is:pr is:open review-requested:@me');
  }

  /** PRs abiertas que abrió el usuario del token. */
  searchAuthored(): Promise<GithubSearchItem[]> {
    return this.search('is:pr is:open author:@me');
  }

  private async search(query: string): Promise<GithubSearchItem[]> {
    const q = encodeURIComponent(query);
    const items: GithubSearchItem[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await this.call(() =>
        this.http.get<GithubSearchResponse>(
          `${API}/search/issues?q=${q}&per_page=${PAGE_SIZE}&page=${page}`,
          this.options(),
        ),
      );
      items.push(...response.items);
      if (response.items.length < PAGE_SIZE) break;
    }

    return items;
  }

  getPullRequest(repo: string, number: number): Promise<GithubPullRequest> {
    return this.call(() =>
      this.http.get<GithubPullRequest>(
        `${API}/repos/${repo}/pulls/${number}`,
        this.options(),
      ),
    );
  }

  getPullRequestDiff(repo: string, number: number): Promise<string> {
    return this.call(() =>
      this.http.get<string>(`${API}/repos/${repo}/pulls/${number}`, {
        ...this.options(),
        headers: {
          ...this.headers,
          Accept: 'application/vnd.github.diff',
        },
        responseType: 'text',
      }),
    );
  }

  /** Contenido en bruto de un archivo en un commit. */
  getFileContent(repo: string, path: string, ref: string): Promise<string> {
    return this.call(() =>
      this.http.get<string>(
        `${API}/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
        {
          ...this.options(),
          headers: {
            ...this.headers,
            Accept: 'application/vnd.github.raw+json',
          },
          responseType: 'text',
          maxContentLength: MAX_FILE_BYTES,
        },
      ),
    );
  }

  // Los comentarios generales de una PR se publican por la API de issues.
  postComment(
    repo: string,
    number: string,
    body: string,
  ): Promise<GithubComment> {
    return this.call(() =>
      this.http.post<GithubComment>(
        `${API}/repos/${repo}/issues/${number}/comments`,
        { body },
        this.options(),
      ),
    );
  }

  private options() {
    return { headers: this.headers, timeout: REQUEST_TIMEOUT_MS };
  }

  private async call<T>(fn: () => Observable<AxiosResponse<T>>): Promise<T> {
    const response = await firstValueFrom(
      fn().pipe(
        catchError((err: AxiosError) => {
          throw this.toHttpException(err);
        }),
      ),
    );
    return response.data;
  }

  private toHttpException(err: AxiosError): HttpException {
    const status = err.response?.status ?? HttpStatus.BAD_GATEWAY;
    return new HttpException(
      `GitHub API error (${status}): ${err.message}`,
      status,
    );
  }
}
