import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { CredentialGroup, GroupInput, ItemInput } from '../models/credential';

@Injectable({ providedIn: 'root' })
export class CredentialsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/credentials`;

  list(): Observable<CredentialGroup[]> {
    return this.http.get<CredentialGroup[]>(this.url);
  }

  create(input: GroupInput): Observable<CredentialGroup> {
    return this.http.post<CredentialGroup>(this.url, input);
  }

  update(id: string, patch: Partial<Omit<GroupInput, 'items'>>): Observable<CredentialGroup> {
    return this.http.patch<CredentialGroup>(`${this.url}/${id}`, patch);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Las operaciones sobre un campo devuelven el grupo ya actualizado. */
  addItem(groupId: string, input: ItemInput): Observable<CredentialGroup> {
    return this.http.post<CredentialGroup>(`${this.url}/${groupId}/items`, input);
  }

  updateItem(
    groupId: string,
    itemId: string,
    patch: Partial<ItemInput>,
  ): Observable<CredentialGroup> {
    return this.http.patch<CredentialGroup>(`${this.url}/${groupId}/items/${itemId}`, patch);
  }

  removeItem(groupId: string, itemId: string): Observable<CredentialGroup> {
    return this.http.delete<CredentialGroup>(`${this.url}/${groupId}/items/${itemId}`);
  }

  reveal(groupId: string, itemId: string): Observable<{ value: string }> {
    return this.http.get<{ value: string }>(`${this.url}/${groupId}/items/${itemId}/reveal`);
  }
}
