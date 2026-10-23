import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RunnersService } from '@executions/application/runners.service';
import { Runner } from '@executions/domain/entities/runner.entity';

type RunnerRequest = Request & { runner?: Runner };

/** Las rutas del runner exigen su token (`Authorization: Bearer wbr_...`). */
@Injectable()
export class RunnerAuthGuard implements CanActivate {
  constructor(private readonly runners: RunnersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RunnerRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    const runner = token ? await this.runners.authenticate(token) : null;
    if (!runner) throw new UnauthorizedException('Invalid runner token');

    request.runner = runner;
    return true;
  }
}

/** El runner que autenticó el guard. */
export const CurrentRunner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Runner =>
    context.switchToHttp().getRequest<RunnerRequest>().runner as Runner,
);
