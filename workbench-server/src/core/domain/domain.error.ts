export type DomainErrorKind = 'validation' | 'conflict' | 'not-found';

/**
 * Error de regla de negocio lanzado desde el dominio y la capa de aplicación.
 * No sabe nada de HTTP: el filtro de infraestructura lo traduce a 400 / 404 / 409.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly kind: DomainErrorKind = 'validation',
  ) {
    super(message);
    this.name = 'DomainError';
  }

  /** Lo pedido no existe (404). */
  static notFound(message: string): DomainError {
    return new DomainError(message, 'not-found');
  }

  /** La operación choca con el estado actual (409). */
  static conflict(message: string): DomainError {
    return new DomainError(message, 'conflict');
  }
}
