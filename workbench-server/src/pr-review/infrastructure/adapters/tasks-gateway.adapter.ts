import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketLookupService } from '@tasks/application/ticket-lookup.service';
import { htmlToText } from '@core/text/html-to-text';
import {
  TicketData,
  TicketsGatewayPort,
} from '@pr-review/domain/ports/tickets-gateway.port';

const MAX_DESCRIPTION_CHARS = 4000;

/** Único punto de pr-review que conoce al módulo tasks. */
@Injectable()
export class TasksGatewayAdapter implements TicketsGatewayPort {
  constructor(
    private readonly tickets: TicketLookupService,
    private readonly config: ConfigService,
  ) {}

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

  /** `<PLANE_API_URL>/<workspace>/browse/MEL-253/` */
  ticketUrl(key: string): string {
    const base = (this.config.get<string>('PLANE_API_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    const workspace = this.config.get<string>('PLANE_WORKSPACE_SLUG') ?? '';
    return `${base}/${workspace}/browse/${encodeURIComponent(key)}/`;
  }
}
