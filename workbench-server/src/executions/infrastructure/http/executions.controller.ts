import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ExecutionsService } from '@executions/application/executions.service';
import { RunnersService } from '@executions/application/runners.service';
import { Execution } from '@executions/domain/entities/execution.entity';
import { Job } from '@executions/domain/entities/job.entity';
import {
  ExecutionDetailDto,
  ExecutionResponseDto,
  JobLogsDto,
  JobSummaryDto,
} from '@executions/dto/execution.dto';

@Controller()
export class ExecutionsController {
  constructor(
    private readonly executions: ExecutionsService,
    private readonly runners: RunnersService,
  ) {}

  /** Empieza a ejecutar la tarea con su último plan. El trabajo lo hace el runner en segundo plano. */
  @Post('issues/:issueId/executions')
  @HttpCode(202)
  async start(
    @Param('issueId') issueId: string,
  ): Promise<ExecutionResponseDto> {
    return this.toDto(await this.executions.start(issueId));
  }

  /** Historial de ejecuciones de la tarea, de la más nueva a la más antigua. */
  @Get('issues/:issueId/executions')
  async list(
    @Param('issueId') issueId: string,
  ): Promise<ExecutionResponseDto[]> {
    const executions = await this.executions.listByIssue(issueId);
    return executions.map((execution) => this.toDto(execution));
  }

  @Get('executions/:id')
  async findById(@Param('id') id: string): Promise<ExecutionDetailDto> {
    const { execution, jobs } = await this.executions.get(id);
    const waiting =
      execution.isActive &&
      jobs.some((job) => job.status === 'pending') &&
      !(await this.runners.anyOnline());

    return {
      ...this.toDto(execution),
      jobs: jobs.map((job) => this.toJobDto(job)),
      waitingForRunner: waiting,
      costUsd: jobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0),
    };
  }

  /** El registro de un trabajo (puede ser largo, por eso no viaja con el detalle). */
  @Get('executions/jobs/:jobId/logs')
  async logs(@Param('jobId') jobId: string): Promise<JobLogsDto> {
    const job = await this.executions.getJob(jobId);
    return { logs: job.logs, status: job.status };
  }

  @Post('executions/:id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string): Promise<ExecutionResponseDto> {
    return this.toDto(await this.executions.cancel(id));
  }

  @Post('executions/:id/retry')
  @HttpCode(202)
  async retry(@Param('id') id: string): Promise<ExecutionResponseDto> {
    return this.toDto(await this.executions.retry(id));
  }

  private toDto(execution: Execution): ExecutionResponseDto {
    return {
      id: execution.id,
      issueId: execution.issueId,
      repo: execution.repo,
      branch: execution.branch,
      baseBranch: execution.baseBranch,
      status: execution.status,
      stages: execution.stages,
      tickets: execution.tickets,
      pullRequestUrl: execution.pullRequestUrl,
      error: execution.error,
      createdAt: execution.createdAt.toISOString(),
      updatedAt: execution.updatedAt.toISOString(),
      finishedAt: execution.finishedAt?.toISOString() ?? null,
    };
  }

  private toJobDto(job: Job): JobSummaryDto {
    return {
      id: job.id,
      kind: job.kind,
      ticketId: job.ticketId,
      status: job.status,
      attempt: job.attempt,
      costUsd: job.costUsd,
      error: job.error,
      runnerId: job.runnerId,
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
  }
}
