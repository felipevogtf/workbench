import { Controller, Get } from '@nestjs/common';
import { AgentProvidersService } from '@ai-agents/application/agent-providers.service';
import { ProviderInfo } from '@ai-agents/domain/providers';

@Controller('agent-providers')
export class AgentProvidersController {
  constructor(private readonly providers: AgentProvidersService) {}

  @Get()
  list(): ProviderInfo[] {
    return this.providers.list();
  }
}
