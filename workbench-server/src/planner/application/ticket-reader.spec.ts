import { TicketsGatewayPort } from '@planner/domain/ports/tickets-gateway.port';
import { readTickets } from './ticket-reader';

const ticket = (key: string) => ({
  key,
  title: `Título ${key}`,
  stateName: null,
  labels: [],
  priority: null,
  descriptionText: null,
});

function gateway(overrides: Partial<TicketsGatewayPort> = {}) {
  return {
    getProjectIdentifiers: jest.fn().mockResolvedValue(['MEL']),
    getTicket: jest.fn((key: string) =>
      Promise.resolve(key === 'MEL-404' ? null : ticket(key)),
    ),
    ...overrides,
  } as jest.Mocked<TicketsGatewayPort>;
}

const options = (warn = jest.fn()) => ({ max: 3, timeoutMs: 1000, warn });

describe('readTickets', () => {
  it('reads the tickets cited in the texts, in the order they appear', async () => {
    const result = await readTickets(
      gateway(),
      ['mira MEL-2', 'y también MEL-1'],
      options(),
    );

    expect(result.tickets.map((t) => t.key)).toEqual(['MEL-2', 'MEL-1']);
    expect(result.missing).toEqual([]);
  });

  it('reports the tickets that do not exist instead of dropping them silently', async () => {
    const result = await readTickets(gateway(), ['MEL-1 y MEL-404'], options());

    expect(result.tickets.map((t) => t.key)).toEqual(['MEL-1']);
    expect(result.missing).toEqual(['MEL-404']);
  });

  it('reports a ticket that could not be read and keeps the others', async () => {
    const warn = jest.fn();
    const gw = gateway({
      getTicket: jest.fn((key: string) =>
        key === 'MEL-2'
          ? Promise.reject(new Error('Plane down'))
          : Promise.resolve(ticket(key)),
      ),
    });

    const result = await readTickets(gw, ['MEL-1 MEL-2'], options(warn));

    expect(result.tickets.map((t) => t.key)).toEqual(['MEL-1']);
    expect(result.missing).toEqual(['MEL-2']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MEL-2'));
  });

  it('reads none, without failing, when Plane does not answer', async () => {
    const warn = jest.fn();
    const gw = gateway({
      getProjectIdentifiers: jest
        .fn()
        .mockRejectedValue(new Error('Plane down')),
    });

    await expect(readTickets(gw, ['MEL-1'], options(warn))).resolves.toEqual({
      tickets: [],
      missing: [],
    });
    expect(warn).toHaveBeenCalled();
  });

  it('reads at most the number of tickets allowed', async () => {
    const result = await readTickets(
      gateway(),
      ['MEL-1 MEL-2 MEL-3 MEL-4'],
      options(),
    );

    expect(result.tickets).toHaveLength(3);
  });
});
