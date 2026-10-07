import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { Agent, AgentInput, ProviderStatus } from '../models/agent';

@Injectable({ providedIn: 'root' })
export class AgentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly url = `${this.base}/agents`;

  list(): Observable<Agent[]> {
    return this.http.get<Agent[]>(this.url);
  }

  get(id: string): Observable<Agent> {
    return this.http.get<Agent>(`${this.url}/${id}`);
  }

  create(input: AgentInput): Observable<Agent> {
    return this.http.post<Agent>(this.url, input);
  }

  update(id: string, patch: Partial<AgentInput>): Observable<Agent> {
    return this.http.patch<Agent>(`${this.url}/${id}`, patch);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  providers(): Observable<ProviderStatus[]> {
    return this.http.get<ProviderStatus[]>(`${this.base}/agent-providers`);
  }

  setDefault(id: string): Observable<Agent> {
    return this.http.post<Agent>(`${this.url}/${id}/default`, {});
  }
}
