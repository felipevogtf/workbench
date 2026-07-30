// tasks/infrastructure/clients/plane-api.client.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PlaneUser,
  PlaneList,
  PlaneProject,
  PlaneProjectMember,
  PlaneIssue,
} from './plane-api.types';

@Injectable()
export class PlaneApiClient {
  private readonly baseUrl: string;
  private readonly workspaceSlug: string;
  private readonly apiKey: string;
  private readonly logger = new Logger(PlaneApiClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('PLANE_API_URL');
    this.workspaceSlug = this.config.getOrThrow<string>('PLANE_WORKSPACE_SLUG');
    this.apiKey = this.config.getOrThrow<string>('PLANE_API_KEY');
  }

  private get headers() {
    return {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
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

  private async callList<T>(
    fn: () => Observable<AxiosResponse<PlaneList<T>>>,
  ): Promise<T[]> {
    const data = await this.call(fn);
    return Array.isArray(data) ? data : data.results;
  }

  private toHttpException(err: AxiosError): HttpException {
    const status = err.response?.status;
    const body = err.response?.data as
      { detail?: string; error?: string; message?: string } | undefined;
    const detail: string =
      body?.detail ?? body?.error ?? body?.message ?? err.message;

    const method = err.config?.method?.toUpperCase() ?? '?';
    const url = err.config?.url ?? '?';
    this.logger.error(
      `Plane API error ${status ?? 'network'} on ${method} ${url}: ${detail}`,
    );

    if (!status) {
      return new HttpException(
        'Could not connect to Plane. Check the URL and network.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const messages: Record<number, string> = {
      401: 'Invalid or expired Plane API key.',
      403: 'Not authorized to perform this action in Plane.',
      404: 'Resource not found in Plane.',
      429: 'Plane request limit reached. Try again later.',
    };

    return new HttpException(
      messages[status] ?? `Plane responded with error ${status}: ${detail}`,
      status >= 400 && status < 500 ? status : HttpStatus.BAD_GATEWAY,
    );
  }

  getCurrentUser(): Promise<PlaneUser> {
    return this.call(() =>
      this.http.get<PlaneUser>(`${this.baseUrl}/api/v1/users/me/`, {
        headers: this.headers,
      }),
    );
  }

  getProjects(): Promise<PlaneProject[]> {
    return this.callList(() =>
      this.http.get<PlaneList<PlaneProject>>(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/`,
        { headers: this.headers },
      ),
    );
  }

  getProject(projectId: string): Promise<PlaneProject> {
    return this.call(() =>
      this.http.get<PlaneProject>(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/${projectId}/`,
        { headers: this.headers },
      ),
    );
  }

  getProjectMembers(projectId: string): Promise<PlaneProjectMember[]> {
    return this.callList(() =>
      this.http.get<PlaneList<PlaneProjectMember>>(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/${projectId}/members/`,
        { headers: this.headers },
      ),
    );
  }

  getIssues(projectId: string): Promise<PlaneIssue[]> {
    return this.callList(() =>
      this.http.get<PlaneList<PlaneIssue>>(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/${projectId}/issues/`,
        { headers: this.headers },
      ),
    );
  }

  getIssue(projectId: string, issueId: string): Promise<PlaneIssue> {
    return this.call(() =>
      this.http.get<PlaneIssue>(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/${projectId}/issues/${issueId}/`,
        { headers: this.headers },
      ),
    );
  }

  createIssue(
    projectId: string,
    dto: Record<string, unknown>,
  ): Promise<PlaneIssue> {
    return this.call(() =>
      this.http.post<PlaneIssue>(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/${projectId}/issues/`,
        dto,
        { headers: this.headers },
      ),
    );
  }

  updateIssue(
    projectId: string,
    issueId: string,
    dto: Record<string, unknown>,
  ): Promise<PlaneIssue> {
    return this.call(() =>
      this.http.patch<PlaneIssue>(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/${projectId}/issues/${issueId}/`,
        dto,
        { headers: this.headers },
      ),
    );
  }

  async deleteIssue(projectId: string, issueId: string): Promise<void> {
    await this.call(() =>
      this.http.delete(
        `${this.baseUrl}/api/v1/workspaces/${this.workspaceSlug}/projects/${projectId}/issues/${issueId}/`,
        { headers: this.headers },
      ),
    );
  }
}
