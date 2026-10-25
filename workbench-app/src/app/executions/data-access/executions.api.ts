import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import {
  CreatedRunner,
  Execution,
  ExecutionDetail,
  ExecutionListItem,
  JobLogs,
  Runner,
} from '../models/execution';

/** Llamadas HTTP de las ejecuciones de tareas y de los runners (sin estado: el estado vive en los stores). */
@Injectable({ providedIn: 'root' })
export class ExecutionsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /** Empieza a ejecutar la tarea con su último plan; el trabajo lo hace el runner en segundo plano. */
  start(issueId: string): Observable<Execution> {
    return this.http.post<Execution>(`${this.base}/issues/${issueId}/executions`, {});
  }

  /** El historial general: las ejecuciones más recientes de todas las tareas. */
  listAll(): Observable<ExecutionListItem[]> {
    return this.http.get<ExecutionListItem[]>(`${this.base}/executions`);
  }

  listByIssue(issueId: string): Observable<Execution[]> {
    return this.http.get<Execution[]>(`${this.base}/issues/${issueId}/executions`);
  }

  get(id: string): Observable<ExecutionDetail> {
    return this.http.get<ExecutionDetail>(`${this.base}/executions/${id}`);
  }

  logs(jobId: string): Observable<JobLogs> {
    return this.http.get<JobLogs>(`${this.base}/executions/jobs/${jobId}/logs`);
  }

  cancel(id: string): Observable<Execution> {
    return this.http.post<Execution>(`${this.base}/executions/${id}/cancel`, {});
  }

  retry(id: string): Observable<Execution> {
    return this.http.post<Execution>(`${this.base}/executions/${id}/retry`, {});
  }

  /** El visto bueno tras crear los tickets: empieza el desarrollo. */
  begin(id: string): Observable<Execution> {
    return this.http.post<Execution>(`${this.base}/executions/${id}/begin`, {});
  }

  /** Cambia quién desarrolla o revisa un ticket (solo mientras se espera el visto bueno). */
  assign(
    id: string,
    ticketId: string,
    body: { developerId?: string; reviewerId?: string },
  ): Observable<Execution> {
    return this.http.patch<Execution>(`${this.base}/executions/${id}/tickets/${ticketId}`, body);
  }

  listRunners(): Observable<Runner[]> {
    return this.http.get<Runner[]>(`${this.base}/runners`);
  }

  createRunner(name: string): Observable<CreatedRunner> {
    return this.http.post<CreatedRunner>(`${this.base}/runners`, { name });
  }

  /** Elige el runner predeterminado; devuelve todos los runners ya actualizados. */
  setDefaultRunner(id: string): Observable<Runner[]> {
    return this.http.post<Runner[]>(`${this.base}/runners/${id}/default`, {});
  }

  deleteRunner(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/runners/${id}`);
  }
}
