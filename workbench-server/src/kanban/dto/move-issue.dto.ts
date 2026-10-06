export class MoveIssueDto {
  // Columna de destino (estado). Sin valor, la tarjeta se queda en su columna;
  // null la deja en "Sin estado".
  stateId?: string | null;
  // Lugar dentro de la columna de destino, contando desde 0.
  index!: number;
}
