import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  UsageOverview,
  UsageService,
} from '@executions/application/usage.service';

const DEFAULT_ZONE = 'America/Santiago';
const MAX_DAYS = 60;

/** El consumo de Claude: cómo va el plan y lo que gasta el Workbench cada día. */
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  /** `tz` es la zona horaria de quien mira (para repartir el gasto por día); `days`, cuántos días del gráfico. */
  @Get()
  overview(
    @Query('tz') tz?: string,
    @Query('days') days?: string,
  ): Promise<UsageOverview> {
    const count = Math.min(Math.max(Number(days) || 14, 1), MAX_DAYS);
    return this.usage.overview(tz?.trim() || DEFAULT_ZONE, count);
  }

  /** Pide medir de nuevo cómo va el plan: lo hace el runner con el próximo latido. */
  @Post('refresh')
  @HttpCode(202)
  refresh(): { requested: true } {
    this.usage.requestRefresh();
    return { requested: true };
  }
}
