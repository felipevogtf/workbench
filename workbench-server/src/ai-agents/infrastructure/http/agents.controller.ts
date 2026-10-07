import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { isAgentModule } from '@ai-agents/domain/modules';
import { AgentsService } from '@ai-agents/application/agents.service';
import { Agent } from '@ai-agents/domain/entities/agent.entity';
import { CreateAgentDto } from '@ai-agents/dto/create-agent.dto';
import { UpdateAgentDto } from '@ai-agents/dto/update-agent.dto';
import { AgentResponseDto } from '@ai-agents/dto/agent-response.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async findAll(@Query('module') module?: string): Promise<AgentResponseDto[]> {
    const agents = await this.agentsService.findAll(
      module && isAgentModule(module) ? module : undefined,
    );
    return agents.map((agent) => this.toDto(agent));
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<AgentResponseDto> {
    return this.toDto(await this.agentsService.findById(id));
  }

  @Post()
  async create(@Body() dto: CreateAgentDto): Promise<AgentResponseDto> {
    return this.toDto(await this.agentsService.create(dto));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentResponseDto> {
    return this.toDto(
      await this.agentsService.update(id, {
        name: dto.name,
        systemPrompt: dto.systemPrompt,
        model: dto.model,
        provider: dto.provider,
        allowedTools: dto.allowedTools,
      }),
    );
  }

  @Post(':id/default')
  @HttpCode(200)
  async setDefault(@Param('id') id: string): Promise<AgentResponseDto> {
    return this.toDto(await this.agentsService.setDefault(id));
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.agentsService.delete(id);
  }

  private toDto(agent: Agent): AgentResponseDto {
    return {
      id: agent.id,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      module: agent.module,
      provider: agent.provider,
      model: agent.model,
      allowedTools: agent.allowedTools,
      isDefault: agent.isDefault,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }
}
