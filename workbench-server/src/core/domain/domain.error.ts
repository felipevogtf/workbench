export type DomainErrorKind = 'validation' | 'conflict';

/**
 * Error de regla de negocio lanzado desde las entidades de dominio.
 * No sabe nada de HTTP: el filtro de infraestructura lo traduce a 400 / 409.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly kind: DomainErrorKind = 'validation',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
