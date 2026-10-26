import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { Recipe, RecipeInput, RepositoryOption } from '../models/recipe';

@Injectable({ providedIn: 'root' })
export class RecipesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/recipes`;

  list(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(this.base);
  }

  /** Los repositorios a los que apuntan las etiquetas: de ahí se elige para qué proyecto es la receta. */
  repositories(): Observable<RepositoryOption[]> {
    return this.http.get<RepositoryOption[]>(`${this.base}/repositories`);
  }

  create(input: RecipeInput): Observable<Recipe> {
    return this.http.post<Recipe>(this.base, input);
  }

  /** El repositorio no se cambia: otro repositorio es otra receta. */
  update(id: string, changes: Pick<RecipeInput, 'content' | 'dependsOn'>): Observable<Recipe> {
    return this.http.patch<Recipe>(`${this.base}/${id}`, changes);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
