import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { Project, ProjectInput, RepositoryOption } from '../models/project';

@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/projects`;

  list(): Observable<Project[]> {
    return this.http.get<Project[]>(this.base);
  }

  /** Los repositorios a los que apuntan las etiquetas: de ahí se elige de qué repositorio es el proyecto. */
  repositories(): Observable<RepositoryOption[]> {
    return this.http.get<RepositoryOption[]>(`${this.base}/repositories`);
  }

  create(input: ProjectInput): Observable<Project> {
    return this.http.post<Project>(this.base, input);
  }

  /** El repositorio no se cambia: otro repositorio es otro proyecto. */
  update(id: string, changes: Omit<ProjectInput, 'repo'>): Observable<Project> {
    return this.http.patch<Project>(`${this.base}/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
