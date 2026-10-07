import { ArgumentsHost } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { DomainErrorFilter } from './domain-error.filter';

function run(error: DomainError) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  new DomainErrorFilter().catch(error, host);
  const [[code]] = status.mock.calls as [[number]];
  const [[body]] = json.mock.calls as [[unknown]];
  return { status: code, body };
}

describe('DomainErrorFilter', () => {
  it('answers 400 to a validation error', () => {
    const { status, body } = run(new DomainError('Nombre vacío'));
    expect(status).toBe(400);
    expect(body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Nombre vacío',
    });
  });

  it('answers 409 to a conflict', () => {
    expect(run(DomainError.conflict('Ya existe')).status).toBe(409);
  });

  it('answers 404 to something that does not exist', () => {
    const { status, body } = run(DomainError.notFound('No existe'));
    expect(status).toBe(404);
    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'No existe',
    });
  });
});
