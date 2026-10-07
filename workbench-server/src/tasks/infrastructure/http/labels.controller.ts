import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { LabelsService } from '@tasks/application/labels.service';
import { CreateLabelDto } from '@tasks/dto/create-label.dto';
import { UpdateLabelDto } from '@tasks/dto/update-label.dto';
import { Label } from '@tasks/domain/entities/label.entity';
import { LabelResponseDto } from '@tasks/dto/label-response.dto';

@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  async findAll(): Promise<LabelResponseDto[]> {
    const labels = await this.labelsService.findAll();
    return labels.map((label) => this.toResponseDto(label));
  }

  @Post()
  async create(
    @Body() createLabelDto: CreateLabelDto,
  ): Promise<LabelResponseDto> {
    const label = await this.labelsService.create(createLabelDto);
    return this.toResponseDto(label);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLabelDto: UpdateLabelDto,
  ): Promise<LabelResponseDto> {
    const label = await this.labelsService.update(id, updateLabelDto);
    return this.toResponseDto(label);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.labelsService.delete(id);
  }

  private toResponseDto(label: Label): LabelResponseDto {
    return {
      id: label.id,
      name: label.name,
      color: label.color,
      repoUrl: label.repoUrl,
    };
  }
}
