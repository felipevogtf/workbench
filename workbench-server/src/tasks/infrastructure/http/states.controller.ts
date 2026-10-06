import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { StatesService } from '@tasks/application/states.service';
import { CreateStateDto } from '@tasks/dto/create-state.dto';
import { State } from '@tasks/domain/entities/state.entity';
import { UpdateStateDto } from '@tasks/dto/update-state.dto';
import { ReorderStatesDto } from '@tasks/dto/reorder-states.dto';
import { StateResponseDto } from '@tasks/dto/state-response.dto';

@Controller('states')
export class StatesController {
  constructor(private readonly statesService: StatesService) {}

  @Get()
  async findAll(): Promise<StateResponseDto[]> {
    const states = await this.statesService.findAll();
    return states.map((state) => this.toResponseDto(state));
  }

  @Post()
  async create(
    @Body() createStateDto: CreateStateDto,
  ): Promise<StateResponseDto> {
    const state = await this.statesService.create(createStateDto);
    return this.toResponseDto(state);
  }

  @Post('reorder')
  async reorder(@Body() dto: ReorderStatesDto): Promise<StateResponseDto[]> {
    const states = await this.statesService.reorder(dto.ids);
    return states.map((state) => this.toResponseDto(state));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateStateDto: UpdateStateDto,
  ): Promise<StateResponseDto> {
    const state = await this.statesService.update(id, updateStateDto);
    return this.toResponseDto(state);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.statesService.delete(id);
  }

  private toResponseDto(state: State): StateResponseDto {
    return {
      id: state.id,
      name: state.name,
      color: state.color,
      position: state.position,
    };
  }
}
