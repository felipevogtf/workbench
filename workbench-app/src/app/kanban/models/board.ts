export interface Board {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface BoardInput {
  name: string;
  description?: string | null;
}

/** Una tarea colocada en un tablero. Una tarea solo puede estar en un tablero. */
export interface BoardCard {
  id: string;
  boardId: string;
  issueId: string;
  position: number;
  createdAt: string;
}

/** Destino de un movimiento: la columna (estado, o `null` = sin estado) y el lugar dentro de ella. */
export interface MoveRequest {
  stateId: string | null;
  /** Posición dentro de la columna, contando desde 0. */
  index: number;
}
