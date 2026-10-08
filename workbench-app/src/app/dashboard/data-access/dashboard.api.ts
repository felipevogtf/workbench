import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url.token';
import { TimeReport } from '../models/time-report';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /**
   * Horas registradas entre dos fechas (`YYYY-MM-DD`, ambas incluidas). Con `includeLocal: false`
   * no cuentan las de tareas locales.
   */
  timeReport(from: string, to: string, includeLocal = true): Observable<TimeReport> {
    return this.http.get<TimeReport>(`${this.base}/time-entries/report`, {
      params: { from, to, includeLocal },
    });
  }
}
