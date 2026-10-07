export interface TicketData {
  key: string;
  title: string;
  stateName: string | null;
  labels: string[];
  priority: string | null;
  descriptionText: string | null;
}

/** Contrato propio del planificador para leer los tickets de Plane citados en una tarea. */
export interface TicketsGatewayPort {
  getProjectIdentifiers(): Promise<string[]>;
  /** `null` si el ticket no existe. */
  getTicket(key: string): Promise<TicketData | null>;
}

export const TICKETS_GATEWAY_PORT = Symbol('PLANNER_TICKETS_GATEWAY_PORT');
