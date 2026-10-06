import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { Agent, AgentInput } from '../models/agent';

@Injectable({ providedIn: 'root' })
export class AgentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/agents`;

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

  setDefault(id: string): Observable<Agent> {
    return this.http.post<Agent>(`${this.url}/${id}/default`, {});
  }
}
