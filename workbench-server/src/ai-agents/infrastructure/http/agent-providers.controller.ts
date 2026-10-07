import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  AgentProvidersService,
  ProviderStatus,
} from '@ai-agents/application/agent-providers.service';

class UpdateProviderDto {
  enabled!: boolean;
}

@Controller('agent-providers')
export class AgentProvidersController {
  constructor(private readonly providers: AgentProvidersService) {}

  @Get()
  list(): Promise<ProviderStatus[]> {
    return this.providers.list();
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
  ): Promise<ProviderStatus[]> {
    return this.providers.setEnabled(id, dto.enabled === true);
  }
}
