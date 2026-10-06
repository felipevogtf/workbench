import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from './api-error';

/** Convierte `{ statusCode, error, message }` del backend (o un fallo de red) en un `ApiError`. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      return throwError(() => new ApiError(messageOf(error), error.status));
    }),
  );

function messageOf(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'No se pudo conectar con el servidor';
  }

  // Con responseType 'text' el cuerpo del error llega como string JSON.
  const raw: unknown = error.error;
  let body: unknown = raw;
  if (typeof raw === 'string') {
    try {
      body = JSON.parse(raw);
    } catch {
      return raw || fallback(error);
    }
  }

  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message) return message;
  return fallback(error);
}

function fallback(error: HttpErrorResponse): string {
  return error.statusText || `Error ${error.status}`;
}
