export interface RemoteTicketData {
  /** Clave normalizada, ej. `MEL-253`. */
  key: string;
  title: string;
  stateName: string | null;
  labels: string[];
  priority: string | null;
  descriptionHtml: string | null;
}

/** Consulta en vivo de tickets (work items) por su clave; no guarda nada en la base. */
export interface TicketSourcePort {
  /** Devuelve null si el ticket no existe o la API key no puede verlo. */
  getTicketByKey(key: string): Promise<RemoteTicketData | null>;
  /** Identificadores de los proyectos visibles (ej. `MEL`, `SER`). */
  getProjectIdentifiers(): Promise<string[]>;
}

export const TICKET_SOURCE_PORT = Symbol('TICKET_SOURCE_PORT');
