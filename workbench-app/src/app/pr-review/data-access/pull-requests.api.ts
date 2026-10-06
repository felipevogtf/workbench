import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import {
  PullRequest,
  PullRequestDetail,
  PullRequestFilters,
  QueueSnapshot,
  ReReviewRequest,
  Review,
  SyncResult,
} from '../models/pull-request';

@Injectable({ providedIn: 'root' })
export class PullRequestsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/pull-requests`;

  list(filters: PullRequestFilters): Observable<PullRequest[]> {
    let params = new HttpParams();
    if (filters.status !== 'all') params = params.set('status', filters.status);
    if (filters.provider !== 'all') params = params.set('provider', filters.provider);
    if (filters.staleOnly) params = params.set('stale', 'true');

    return this.http.get<PullRequest[]>(this.url, { params });
  }

  get(id: string): Observable<PullRequestDetail> {
    return this.http.get<PullRequestDetail>(`${this.url}/${id}`);
  }

  queue(): Observable<QueueSnapshot> {
    return this.http.get<QueueSnapshot>(`${this.url}/queue`);
  }

  sync(): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.url}/sync`, {});
  }

  /** La PR queda en cola (`pending`); la revisión ocurre después, de forma asíncrona. */
  reReview(id: string, request: ReReviewRequest): Observable<PullRequest> {
    return this.http.post<PullRequest>(`${this.url}/${id}/re-review`, request);
  }

  retryComment(id: string): Observable<Review> {
    return this.http.post<Review>(`${this.url}/${id}/retry-comment`, {});
  }

  /** Markdown de la última revisión correcta. */
  latestReview(id: string): Observable<string> {
    return this.http.get(`${this.url}/${id}/review`, { responseType: 'text' });
  }

  /** Markdown de una revisión concreta. */
  review(id: string, reviewId: string): Observable<string> {
    return this.http.get(`${this.url}/${id}/reviews/${reviewId}`, { responseType: 'text' });
  }
}
