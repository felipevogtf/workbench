import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { PlansService } from '@planner/application/plans.service';
import { Plan } from '@planner/domain/entities/plan.entity';
import { CreatePlanDto, PlanResponseDto } from '@planner/dto/plan.dto';

@Controller()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /** Encola un plan para la tarea; se genera en segundo plano (consultar con GET). */
  @Post('issues/:issueId/plans')
  @HttpCode(202)
  async create(
    @Param('issueId') issueId: string,
    @Body() dto: CreatePlanDto = {},
  ): Promise<PlanResponseDto> {
    const plan = await this.plansService.create(issueId, {
      agentId: dto?.agentId,
      model: dto?.model,
    });
    return this.toDto(plan);
  }

  /** Historial de planes de la tarea, del más nuevo al más antiguo (sin el contenido). */
  @Get('issues/:issueId/plans')
  async list(@Param('issueId') issueId: string): Promise<PlanResponseDto[]> {
    const plans = await this.plansService.listByIssue(issueId);
    return plans.map((plan) => this.toDto(plan));
  }

  @Get('plans/:id')
  async findById(@Param('id') id: string): Promise<PlanResponseDto> {
    return this.toDto(await this.plansService.get(id), true);
  }

  @Delete('plans/:id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.plansService.delete(id);
  }

  private toDto(plan: Plan, withContent = false): PlanResponseDto {
    return {
      id: plan.id,
      issueId: plan.issueId,
      status: plan.status,
      agentName: plan.agentName,
      model: plan.model,
      repos: plan.repos,
      error: plan.error,
      ...(withContent ? { content: plan.content } : {}),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}
