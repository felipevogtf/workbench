import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '@core/domain/domain.error';

const STATUS = { validation: 400, conflict: 409, 'not-found': 404 } as const;
const TITLE = {
  validation: 'Bad Request',
  conflict: 'Conflict',
  'not-found': 'Not Found',
} as const;

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const status = STATUS[error.kind];
    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      error: TITLE[error.kind],
      message: error.message,
    });
  }
}
