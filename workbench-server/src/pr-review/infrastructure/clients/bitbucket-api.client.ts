import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BitbucketComment,
  BitbucketPage,
  BitbucketPullRequest,
  BitbucketRepository,
  BitbucketUser,
} from './bitbucket-api.types';

const API = 'https://api.bitbucket.org/2.0';
const REQUEST_TIMEOUT_MS = 60_000;

@Injectable()
export class BitbucketApiClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /** Los tres datos deben estar para que el provider quede habilitado. */
  isConfigured(): boolean {
    return Boolean(
      this.config.get('BITBUCKET_EMAIL') &&
      this.config.get('BITBUCKET_TOKEN') &&
      this.config.get('BITBUCKET_WORKSPACE'),
    );
  }

  get workspace(): string {
    return this.config.getOrThrow<string>('BITBUCKET_WORKSPACE');
  }

  private get headers() {
    const email = this.config.getOrThrow<string>('BITBUCKET_EMAIL');
    const token = this.config.getOrThrow<string>('BITBUCKET_TOKEN');
    return {
      Authorization:
        'Basic ' + Buffer.from(`${email}:${token}`).toString('base64'),
      Accept: 'application/json',
    };
  }

  getCurrentUser(): Promise<BitbucketUser> {
    return this.call(() =>
      this.http.get<BitbucketUser>(`${API}/user`, this.options()),
    );
  }

  async getRepositories(): Promise<BitbucketRepository[]> {
    return this.paginate<BitbucketRepository>(
      `${API}/repositories/${this.workspace}?pagelen=100`,
    );
  }

  /** PRs abiertas del repo donde `reviewerUuid` figura como reviewer. */
  async getPullRequestsToReview(
    repoSlug: string,
    reviewerUuid: string,
  ): Promise<BitbucketPullRequest[]> {
    const query = `state="OPEN" AND reviewers.uuid="${reviewerUuid}"`;
    return this.paginate<BitbucketPullRequest>(
      `${API}/repositories/${this.workspace}/${repoSlug}/pullrequests` +
        `?pagelen=50&q=${encodeURIComponent(query)}`,
    );
  }

  getPullRequest(
    repoFullName: string,
    pullRequestId: string,
  ): Promise<BitbucketPullRequest> {
    return this.call(() =>
      this.http.get<BitbucketPullRequest>(
        `${API}/repositories/${repoFullName}/pullrequests/${pullRequestId}`,
        this.options(),
      ),
    );
  }

  postComment(
    repoFullName: string,
    pullRequestId: string,
    raw: string,
  ): Promise<BitbucketComment> {
    return this.call(() =>
      this.http.post<BitbucketComment>(
        `${API}/repositories/${repoFullName}/pullrequests/${pullRequestId}/comments`,
        { content: { raw } },
        this.options(),
      ),
    );
  }

  private async paginate<T>(firstUrl: string): Promise<T[]> {
    const all: T[] = [];
    let url: string | undefined = firstUrl;

    while (url) {
      const currentUrl: string = url;
      const page = await this.call(() =>
        this.http.get<BitbucketPage<T>>(currentUrl, this.options()),
      );
      all.push(...(page.values ?? []));
      url = page.next;
    }

    return all;
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
      `Bitbucket API error (${status}): ${err.message}`,
      status,
    );
  }
}
