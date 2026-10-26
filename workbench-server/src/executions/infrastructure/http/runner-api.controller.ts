import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RunnerJobsService } from '@executions/application/runner-jobs.service';
import { RunnersService } from '@executions/application/runners.service';
import { UsageService } from '@executions/application/usage.service';
import { parseLimits } from '@executions/domain/usage';
import { Runner } from '@executions/domain/entities/runner.entity';
import {
  RunnerHeartbeatDto,
  RunnerHelloDto,
  RunnerJobDto,
  RunnerLogsDto,
  RunnerResponseDto,
  RunnerResultDto,
  RunnerUsageDto,
} from '@executions/dto/runner.dto';
import { CurrentRunner, RunnerAuthGuard } from './runner-auth.guard';
import { toRunnerDto } from './runner.mapper';

/** Lo que usa el programa runner del PC. Todo exige su token. */
@Controller('runner')
@UseGuards(RunnerAuthGuard)
export class RunnerApiController {
  constructor(
    private readonly runners: RunnersService,
    private readonly jobs: RunnerJobsService,
    private readonly usage: UsageService,
  ) {}

  /** El runner se presenta al arrancar. */
  @Post('hello')
  @HttpCode(200)
  async hello(
    @CurrentRunner() runner: Runner,
    @Body() dto: RunnerHelloDto,
  ): Promise<RunnerResponseDto> {
    await this.runners.introduce(runner, dto);
    return toRunnerDto(runner);
  }

  /** Señal de vida. Responde qué trabajos debe detener. */
  @Post('heartbeat')
  @HttpCode(200)
  async heartbeat(
    @CurrentRunner() runner: Runner,
    @Body() dto: RunnerHeartbeatDto,
  ): Promise<{ stop: string[]; probe: boolean }> {
    const stop = await this.jobs.heartbeat(runner, dto.runningJobIds);
    // Si el usuario pidió actualizar cómo va el plan, el runner hace una medida mínima.
    return { stop, probe: this.usage.takeRefreshRequest() };
  }

  /** La medida del plan que hizo el runner a pedido del usuario. */
  @Post('usage')
  @HttpCode(204)
  async reportUsage(@Body() dto: RunnerUsageDto): Promise<void> {
    await this.usage.record(parseLimits(dto.limits), 'probe');
  }

  /** Espera hasta ~25 s por un trabajo. 204 si no hubo ninguno. */
  @Post('jobs/claim')
  async claim(
    @CurrentRunner() runner: Runner,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RunnerJobDto | undefined> {
    const job = await this.jobs.claim(runner);
    if (!job) {
      response.status(204);
      return undefined;
    }

    response.status(200);
    return {
      id: job.id,
      executionId: job.executionId,
      kind: job.kind,
      attempt: job.attempt,
      payload: job.payload,
    };
  }

  /** Agrega salida al registro del trabajo. `ok: false` si el trabajo ya no es de este runner. */
  @Post('jobs/:id/logs')
  @HttpCode(200)
  async logs(
    @CurrentRunner() runner: Runner,
    @Param('id') id: string,
    @Body() dto: RunnerLogsDto,
  ): Promise<{ ok: boolean }> {
    return { ok: await this.jobs.appendLogs(runner, id, dto.text) };
  }

  @Post('jobs/:id/result')
  @HttpCode(204)
  async result(
    @CurrentRunner() runner: Runner,
    @Param('id') id: string,
    @Body() dto: RunnerResultDto,
  ): Promise<void> {
    await this.jobs.finish(runner, id, dto);
  }
}
