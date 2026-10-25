import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ExecutionsService } from '@executions/application/executions.service';
import { RunnersService } from '@executions/application/runners.service';
import { Execution } from '@executions/domain/entities/execution.entity';
import { Job } from '@executions/domain/entities/job.entity';
import { parseReview } from '@executions/domain/json-output';
import {
  AssignTicketDto,
  ExecutionDetailDto,
  ExecutionListItemDto,
  ExecutionResponseDto,
  JobLogsDto,
  JobSummaryDto,
} from '@executions/dto/execution.dto';

/** Lo que se muestra de la respuesta de un desarrollador: su resumen, no un informe entero. */
const MAX_OUTPUT = 2000;

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

  /** El historial general: lo que se está ejecutando y lo que ya se ejecutó, de todas las tareas. */
  @Get('executions')
  async listAll(): Promise<ExecutionListItemDto[]> {
    const items = await this.executions.listRecent();
    return items.map(({ execution, issueName }) => ({
      ...this.toDto(execution),
      issueName,
    }));
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

  /** El visto bueno tras crear los tickets: empieza el desarrollo. */
  @Post('executions/:id/begin')
  @HttpCode(202)
  async begin(@Param('id') id: string): Promise<ExecutionResponseDto> {
    return this.toDto(await this.executions.begin(id));
  }

  /** Cambia quién desarrolla o revisa un ticket, mientras se espera el visto bueno. */
  @Patch('executions/:id/tickets/:ticketId')
  async assign(
    @Param('id') id: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: AssignTicketDto,
  ): Promise<ExecutionResponseDto> {
    return this.toDto(await this.executions.assign(id, ticketId, dto));
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
      repos: execution.targets(),
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

  /** El veredicto del revisor, si el trabajo es una revisión terminada con una respuesta válida. */
  private reviewOf(job: Job, output: string): JobSummaryDto['review'] {
    if (job.kind !== 'review' || job.status !== 'done') return null;
    try {
      return parseReview(output);
    } catch {
      return null;
    }
  }

  private toJobDto(job: Job): JobSummaryDto {
    const output = job.result?.output ?? '';
    return {
      agentId: job.payload.agent?.id ?? null,
      agentName: job.payload.agent?.name ?? null,
      output:
        job.kind === 'develop' && output ? output.slice(0, MAX_OUTPUT) : null,
      review: this.reviewOf(job, output),
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
