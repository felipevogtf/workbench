/** Mensaje de cualquier error capturado, para mostrar al usuario. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado';
}
