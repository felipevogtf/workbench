import { InjectionToken } from '@angular/core';

/** Prefijo de las llamadas al backend. `ng serve` y nginx lo reenvían al servidor (sin el prefijo). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
