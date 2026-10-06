import { TicketLookupService } from './ticket-lookup.service';
import type {
  RemoteTicketData,
  TicketSourcePort,
} from '@tasks/domain/ports/ticket-source.port';

const ticket: RemoteTicketData = {
  key: 'MEL-253',
  title: 'HU: Entidad Maestro',
  stateName: 'En revisión',
  labels: ['backend'],
  priority: 'medium',
  descriptionHtml: '<p>Hola</p>',
};

function build(source: Partial<TicketSourcePort>) {
  const full: TicketSourcePort = {
    getTicketByKey: jest.fn().mockResolvedValue(null),
    getProjectIdentifiers: jest.fn().mockResolvedValue([]),
    ...source,
  };
  return { service: new TicketLookupService(full), source: full };
}

describe('TicketLookupService.findByKey', () => {
  it('normalizes the key before asking Plane', async () => {
    const getTicketByKey = jest.fn().mockResolvedValue(ticket);
    const { service } = build({ getTicketByKey });

    await expect(service.findByKey(' mel-253 ')).resolves.toEqual(ticket);

    expect(getTicketByKey).toHaveBeenCalledWith('MEL-253');
  });

  it('returns null when the ticket does not exist', async () => {
    const { service } = build({});

    await expect(service.findByKey('MEL-999')).resolves.toBeNull();
  });
});

describe('TicketLookupService.listProjectIdentifiers', () => {
  afterEach(() => jest.useRealTimers());

  it('normalizes, removes duplicates and caches for an hour', async () => {
    jest.useFakeTimers();
    const getProjectIdentifiers = jest
      .fn()
      .mockResolvedValue(['mel', 'SER', 'MEL', ' ']);
    const { service } = build({ getProjectIdentifiers });

    expect(await service.listProjectIdentifiers()).toEqual(['MEL', 'SER']);
    await service.listProjectIdentifiers();
    expect(getProjectIdentifiers).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(61 * 60 * 1000);
    await service.listProjectIdentifiers();
    expect(getProjectIdentifiers).toHaveBeenCalledTimes(2);
  });

  it('keeps using the last known list when Plane fails after the cache expired', async () => {
    jest.useFakeTimers();
    const getProjectIdentifiers = jest
      .fn()
      .mockResolvedValueOnce(['MEL'])
      .mockRejectedValueOnce(new Error('Plane down'));
    const { service } = build({ getProjectIdentifiers });
    await service.listProjectIdentifiers();

    jest.advanceTimersByTime(61 * 60 * 1000);

    await expect(service.listProjectIdentifiers()).resolves.toEqual(['MEL']);
  });

  it('propagates the error when there is no list to fall back on', async () => {
    const { service } = build({
      getProjectIdentifiers: jest
        .fn()
        .mockRejectedValue(new Error('Plane down')),
    });

    await expect(service.listProjectIdentifiers()).rejects.toThrow(
      'Plane down',
    );
  });
});
