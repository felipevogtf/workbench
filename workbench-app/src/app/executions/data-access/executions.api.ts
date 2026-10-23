import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { CreatedRunner, Execution, ExecutionDetail, JobLogs, Runner } from '../models/execution';

/** Llamadas HTTP de las ejecuciones de tareas y de los runners (sin estado: el estado vive en los stores). */
@Injectable({ providedIn: 'root' })
export class ExecutionsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /** Empieza a ejecutar la tarea con su último plan; el trabajo lo hace el runner en segundo plano. */
  start(issueId: string): Observable<Execution> {
    return this.http.post<Execution>(`${this.base}/issues/${issueId}/executions`, {});
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

  listRunners(): Observable<Runner[]> {
    return this.http.get<Runner[]>(`${this.base}/runners`);
  }

  createRunner(name: string): Observable<CreatedRunner> {
    return this.http.post<CreatedRunner>(`${this.base}/runners`, { name });
  }

  deleteRunner(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/runners/${id}`);
  }
}
