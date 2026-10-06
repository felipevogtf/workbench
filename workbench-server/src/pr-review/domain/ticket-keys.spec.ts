import { extractTicketKeys } from './ticket-keys';

// Una muestra de los identificadores reales de Plane.
const IDS = ['MEL', 'SER', 'SERCSD', 'MSD', 'MASISAB2B', 'APS', 'GLMVP'];

describe('extractTicketKeys', () => {
  it.each([
    ['feature/MEL-253/entida-conductores-camiones', ['MEL-253']],
    ['feature/mel-349/sincronizacion-sucursales', ['MEL-349']],
    ['feature/MEL-183-MEL-182/integracion-jd', ['MEL-183', 'MEL-182']],
    ['festure/MEL-183/nueva-razon-bloqueo', ['MEL-183']],
    ['feature/mel-100/creacion-mensaje-mimixer', ['MEL-100']],
    ['fix/log-email', []],
    ['feature/firma-por-foto', []],
  ])('reads the ticket codes of the branch %s', (branch, expected) => {
    expect(extractTicketKeys([branch], IDS)).toEqual(expected);
  });

  it('reads tickets of any known project, not just one', () => {
    expect(extractTicketKeys(['Cubre SER-10 y MASISAB2B-7'], IDS)).toEqual([
      'SER-10',
      'MASISAB2B-7',
    ]);
  });

  it('does not read SER-1 inside SERCSD-1', () => {
    expect(extractTicketKeys(['SERCSD-1'], IDS)).toEqual(['SERCSD-1']);
  });

  it('joins the branch and the description without repeating a ticket', () => {
    const keys = extractTicketKeys(
      ['feature/MEL-253/x', 'Ticket: mel-253 y SER-10'],
      IDS,
    );

    expect(keys).toEqual(['MEL-253', 'SER-10']);
  });

  it('puts the branch tickets first', () => {
    expect(extractTicketKeys(['feature/SER-1', 'MEL-9'], IDS)).toEqual([
      'SER-1',
      'MEL-9',
    ]);
  });

  it('reads several tickets separated by commas or lines', () => {
    expect(extractTicketKeys(['Tickets: MEL-1, MEL-2\nMEL-3'], IDS)).toEqual([
      'MEL-1',
      'MEL-2',
      'MEL-3',
    ]);
  });

  it('reads the code inside a link to Plane', () => {
    expect(
      extractTicketKeys(
        ['https://plane.example.com/garage-labs/browse/MEL-253/'],
        IDS,
      ),
    ).toEqual(['MEL-253']);
  });

  it('ignores codes of projects that do not exist in Plane', () => {
    expect(
      extractTicketKeys(['UTF-8, ISO-8601, ES-2022 y CVE-2024-1234'], IDS),
    ).toEqual([]);
  });

  it('requires the hyphen and a clean boundary', () => {
    expect(extractTicketKeys(['APS 12', 'XMEL-5', 'MEL-5a'], IDS)).toEqual([]);
  });

  it('normalizes leading zeros', () => {
    expect(extractTicketKeys(['MEL-0253'], IDS)).toEqual(['MEL-253']);
  });

  it('returns at most the requested number of tickets', () => {
    const text = 'MEL-1 MEL-2 MEL-3 MEL-4 MEL-5 MEL-6 MEL-7';

    expect(extractTicketKeys([text], IDS)).toHaveLength(5);
    expect(extractTicketKeys([text], IDS, 2)).toEqual(['MEL-1', 'MEL-2']);
  });

  it('copes with empty texts and an empty list of projects', () => {
    expect(extractTicketKeys([null, undefined, ''], IDS)).toEqual([]);
    expect(extractTicketKeys(['MEL-1'], [])).toEqual([]);
  });

  it('is not confused by regex characters in an identifier', () => {
    expect(extractTicketKeys(['A.B-1 y AXB-2'], ['A.B'])).toEqual(['A.B-1']);
  });
});
