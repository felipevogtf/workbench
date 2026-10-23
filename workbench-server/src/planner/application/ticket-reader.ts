import { withTimeout } from '@core/async/with-timeout';
import { extractTicketKeys } from '@core/text/ticket-keys';
import {
  TicketData,
  TicketsGatewayPort,
} from '@planner/domain/ports/tickets-gateway.port';

export interface TicketReading {
  tickets: TicketData[];
  /** Códigos citados que no se pudieron leer (no existen, o Plane no respondió). */
  missing: string[];
}

export interface TicketReadingOptions {
  max: number;
  timeoutMs: number;
  warn: (message: string) => void;
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Lee de Plane los tickets citados en los textos (en el orden en que aparecen, hasta `max`). Nunca
 * lanza: lo que no se pueda leer queda en `missing`, y si Plane no responde no se trae ninguno.
 */
export async function readTickets(
  gateway: TicketsGatewayPort,
  texts: ReadonlyArray<string | null | undefined>,
  { max, timeoutMs, warn }: TicketReadingOptions,
): Promise<TicketReading> {
  try {
    const identifiers = await withTimeout(
      gateway.getProjectIdentifiers(),
      timeoutMs,
    );
    const keys = extractTicketKeys(texts, identifiers, max);

    const results = await Promise.all(
      keys.map(async (key) => {
        try {
          return await withTimeout(gateway.getTicket(key), timeoutMs);
        } catch (error) {
          warn(`Could not read ticket ${key}: ${message(error)}`);
          return null;
        }
      }),
    );

    return {
      tickets: results.filter(
        (ticket): ticket is TicketData => ticket !== null,
      ),
      missing: keys.filter((_, index) => results[index] === null),
    };
  } catch (error) {
    warn(`Could not read Plane tickets: ${message(error)}`);
    return { tickets: [], missing: [] };
  }
}
