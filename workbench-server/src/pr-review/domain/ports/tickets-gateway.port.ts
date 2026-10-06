export interface TicketData {
  key: string;
  title: string;
  stateName: string | null;
  labels: string[];
  priority: string | null;
  /** Descripción del ticket ya convertida a texto y recortada. */
  descriptionText: string;
}

/** Contrato propio de pr-review hacia el módulo tasks (Plane). */
export interface TicketsGatewayPort {
  /** Identificadores de proyecto de Plane (`MEL`, `SER`, …). */
  getProjectIdentifiers(): Promise<string[]>;
  /** null si el ticket no existe o no es visible. */
  getTicket(key: string): Promise<TicketData | null>;
  /** Enlace al ticket en Plane. */
  ticketUrl(key: string): string;
}

export const TICKETS_GATEWAY_PORT = Symbol('TICKETS_GATEWAY_PORT');
