import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { Board, BoardCard, BoardInput, MoveRequest } from '../models/board';

@Injectable({ providedIn: 'root' })
export class BoardsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/boards`;

  list(): Observable<Board[]> {
    return this.http.get<Board[]>(this.url);
  }

  create(input: BoardInput): Observable<Board> {
    return this.http.post<Board>(this.url, input);
  }

  update(id: string, patch: Partial<BoardInput>): Observable<Board> {
    return this.http.patch<Board>(`${this.url}/${id}`, patch);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  cards(boardId: string): Observable<BoardCard[]> {
    return this.http.get<BoardCard[]>(`${this.url}/${boardId}/issues`);
  }

  /** Las tarjetas de todos los tableros (sirve para saber qué tareas ya están en uno). */
  assignments(): Observable<BoardCard[]> {
    return this.http.get<BoardCard[]>(`${this.url}/assignments`);
  }

  addIssue(boardId: string, issueId: string): Observable<BoardCard> {
    return this.http.post<BoardCard>(`${this.url}/${boardId}/issues`, { issueId });
  }

  removeIssue(boardId: string, issueId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${boardId}/issues/${issueId}`);
  }

  move(boardId: string, issueId: string, request: MoveRequest): Observable<void> {
    return this.http.patch<void>(`${this.url}/${boardId}/issues/${issueId}/move`, request);
  }
}
