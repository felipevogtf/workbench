import { Injectable } from '@nestjs/common';
import { TicketLookupService } from '@tasks/application/ticket-lookup.service';
import { htmlToText } from '@tasks/domain/html-to-text';
import {
  TicketData,
  TicketsGatewayPort,
} from '@planner/domain/ports/tickets-gateway.port';

const MAX_DESCRIPTION_CHARS = 4000;

/** Lee los tickets de Plane citados en una tarea (a través de tasks). */
@Injectable()
export class TicketsGatewayAdapter implements TicketsGatewayPort {
  constructor(private readonly tickets: TicketLookupService) {}

  getProjectIdentifiers(): Promise<string[]> {
    return this.tickets.listProjectIdentifiers();
  }

  async getTicket(key: string): Promise<TicketData | null> {
    const ticket = await this.tickets.findByKey(key);
    if (!ticket) return null;

    return {
      key: ticket.key,
      title: ticket.title,
      stateName: ticket.stateName,
      labels: ticket.labels,
      priority: ticket.priority,
      descriptionText: htmlToText(
        ticket.descriptionHtml,
        MAX_DESCRIPTION_CHARS,
      ),
    };
  }
}
