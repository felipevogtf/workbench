import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import {
  NewOrganizerSession,
  OrganizerSession,
  OrganizerSessionSummary,
} from '../models/organizer';

/** Llamadas HTTP del organizador (sin estado; el estado vive en el store). */
@Injectable({ providedIn: 'root' })
export class OrganizerApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/organizer/sessions`;

  list(): Observable<OrganizerSessionSummary[]> {
    return this.http.get<OrganizerSessionSummary[]>(this.base);
  }

  get(id: string): Observable<OrganizerSession> {
    return this.http.get<OrganizerSession>(`${this.base}/${id}`);
  }

  create(input: NewOrganizerSession): Observable<OrganizerSession> {
    return this.http.post<OrganizerSession>(this.base, input);
  }

  update(id: string, patch: { title?: string; notes?: string }): Observable<OrganizerSession> {
    return this.http.patch<OrganizerSession>(`${this.base}/${id}`, patch);
  }

  /** Deja como tareas del grupo exactamente estas, en este orden. */
  setMembers(id: string, issueIds: string[]): Observable<OrganizerSession> {
    return this.http.put<OrganizerSession>(`${this.base}/${id}/members`, { issueIds });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
