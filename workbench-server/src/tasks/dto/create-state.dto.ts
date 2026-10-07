export class CreateStateDto {
  name!: string;
  color?: string | null;
  // Opcional: sin posición, el estado queda al final.
  position?: number;
  /** Las tareas en este estado cuentan como finalizadas. */
  isFinal?: boolean;
}
