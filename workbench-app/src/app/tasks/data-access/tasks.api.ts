import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { Issue, IssueInput } from '../models/issue';
import { Plan, PlanRequest } from '../models/plan';
import {
  Label,
  LabelInput,
  Project,
  State,
  StateInput,
  SyncResult,
  TimeEntry,
  TimeEntryInput,
} from '../models/catalogs';

/** Llamadas HTTP del módulo de tareas (sin estado; el estado vive en los stores). */
@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  // Tareas
  listIssues(): Observable<Issue[]> {
    return this.http.get<Issue[]>(`${this.base}/issues`);
  }

  getIssue(id: string): Observable<Issue> {
    return this.http.get<Issue>(`${this.base}/issues/${id}`);
  }

  createIssue(input: IssueInput): Observable<Issue> {
    return this.http.post<Issue>(`${this.base}/issues`, input);
  }

  updateIssue(id: string, patch: Partial<IssueInput>): Observable<Issue> {
    return this.http.patch<Issue>(`${this.base}/issues/${id}`, patch);
  }

  deleteIssue(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/issues/${id}`);
  }

  /** Proyectos y tareas de Plane, en un solo paso. */
  sync(): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.base}/sync`, {});
  }

  // Proyectos
  listProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.base}/projects`);
  }

  createProject(input: { name: string }): Observable<Project> {
    return this.http.post<Project>(`${this.base}/projects`, input);
  }

  updateProject(id: string, input: { name: string }): Observable<Project> {
    return this.http.patch<Project>(`${this.base}/projects/${id}`, input);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/projects/${id}`);
  }

  // Estados
  listStates(): Observable<State[]> {
    return this.http.get<State[]>(`${this.base}/states`);
  }

  createState(input: StateInput): Observable<State> {
    return this.http.post<State>(`${this.base}/states`, input);
  }

  updateState(id: string, patch: Partial<StateInput>): Observable<State> {
    return this.http.patch<State>(`${this.base}/states/${id}`, patch);
  }

  deleteState(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/states/${id}`);
  }

  /** Deja los estados en el orden recibido. */
  reorderStates(ids: string[]): Observable<State[]> {
    return this.http.post<State[]>(`${this.base}/states/reorder`, { ids });
  }

  // Etiquetas
  listLabels(): Observable<Label[]> {
    return this.http.get<Label[]>(`${this.base}/labels`);
  }

  createLabel(input: LabelInput): Observable<Label> {
    return this.http.post<Label>(`${this.base}/labels`, input);
  }

  updateLabel(id: string, patch: Partial<LabelInput>): Observable<Label> {
    return this.http.patch<Label>(`${this.base}/labels/${id}`, patch);
  }

  deleteLabel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/labels/${id}`);
  }

  // Planes de ejecución
  listPlans(issueId: string): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.base}/issues/${issueId}/plans`);
  }

  getPlan(id: string): Observable<Plan> {
    return this.http.get<Plan>(`${this.base}/plans/${id}`);
  }

  createPlan(issueId: string, request: PlanRequest): Observable<Plan> {
    return this.http.post<Plan>(`${this.base}/issues/${issueId}/plans`, request);
  }

  deletePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/plans/${id}`);
  }

  // Horas
  listTimeEntries(issueId: string): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(`${this.base}/time-entries/issue/${issueId}`);
  }

  createTimeEntry(input: TimeEntryInput): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.base}/time-entries`, input);
  }

  deleteTimeEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/time-entries/${id}`);
  }
}
