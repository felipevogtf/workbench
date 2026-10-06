import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  TICKET_SOURCE_PORT,
  type RemoteTicketData,
  type TicketSourcePort,
} from '@tasks/domain/ports/ticket-source.port';

const IDENTIFIERS_TTL_MS = 60 * 60 * 1000;

/**
 * Consulta de tickets para otros módulos (ej. pr-review). Lee de Plane en vivo:
 * no escribe en la base de datos de tasks.
 */
@Injectable()
export class TicketLookupService {
  private readonly logger = new Logger(TicketLookupService.name);
  private cache: { identifiers: string[]; at: number } | null = null;

  constructor(
    @Inject(TICKET_SOURCE_PORT)
    private readonly source: TicketSourcePort,
  ) {}

  /** null si el ticket no existe o la API key no lo ve. Otros errores se propagan. */
  findByKey(key: string): Promise<RemoteTicketData | null> {
    return this.source.getTicketByKey(key.trim().toUpperCase());
  }

  /**
   * Identificadores de proyecto (`MEL`, `SER`, …), con caché de 1 hora. Si Plane falla se
   * reutiliza la última lista conocida; si nunca hubo una, el error se propaga.
   */
  async listProjectIdentifiers(): Promise<string[]> {
    const cached = this.cache;
    if (cached && Date.now() - cached.at < IDENTIFIERS_TTL_MS) {
      return cached.identifiers;
    }

    try {
      const identifiers = [
        ...new Set(
          (await this.source.getProjectIdentifiers())
            .map((identifier) => identifier.trim().toUpperCase())
            .filter(Boolean),
        ),
      ];
      this.cache = { identifiers, at: Date.now() };
      return identifiers;
    } catch (error) {
      if (cached) {
        this.logger.warn(
          'Could not refresh Plane project identifiers; using the last known list',
        );
        return cached.identifiers;
      }
      throw error;
    }
  }
}
