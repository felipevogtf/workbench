import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { RunnersService } from '@executions/application/runners.service';
import {
  CreatedRunnerDto,
  CreateRunnerDto,
  RunnerResponseDto,
} from '@executions/dto/runner.dto';
import { toRunnerDto } from './runner.mapper';

/** Alta y baja de runners desde la app (no la usa el runner: esas son las rutas de `runner/`). */
@Controller('runners')
export class RunnersController {
  constructor(private readonly runners: RunnersService) {}

  @Get()
  async list(): Promise<RunnerResponseDto[]> {
    return (await this.runners.findAll()).map(toRunnerDto);
  }

  /** Crea un runner y devuelve su token, que no se vuelve a mostrar. */
  @Post()
  async create(@Body() dto: CreateRunnerDto): Promise<CreatedRunnerDto> {
    const { runner, token } = await this.runners.create(dto.name);
    return { ...toRunnerDto(runner), token };
  }

  /** Revoca el runner: su token deja de servir. */
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.runners.delete(id);
  }
}
