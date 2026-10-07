import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class MoveIssueDto {
  // Columna de destino (estado). Sin valor, la tarjeta se queda en su columna;
  // null la deja en "Sin estado".
  @IsOptional()
  @IsUUID()
  stateId?: string | null;

  // Lugar dentro de la columna de destino, contando desde 0.
  @IsInt()
  @Min(0)
  index!: number;
}
