import { Inject, Injectable } from '@nestjs/common';
import { Label } from '@tasks/domain/entities/label.entity';
import {
  LABEL_REPOSITORY_PORT,
  type LabelRepositoryPort,
} from '@tasks/domain/ports/label-repository.port';

export interface CreateLabelData {
  name: string;
  color?: string | null;
}

export type UpdateLabelData = Partial<CreateLabelData>;

@Injectable()
export class LabelsService {
  constructor(
    @Inject(LABEL_REPOSITORY_PORT)
    private readonly labelRepository: LabelRepositoryPort,
  ) {}

  async findAll(): Promise<Label[]> {
    return this.labelRepository.findAll();
  }

  async create(data: CreateLabelData): Promise<Label> {
    const label = Label.create(data);
    await this.labelRepository.save(label);
    return label;
  }

  async update(id: string, data: UpdateLabelData): Promise<Label> {
    const existingLabel = await this.labelRepository.findById(id);
    if (!existingLabel) {
      throw new Error(`Label with id ${id} not found`);
    }

    if (data.name !== undefined) {
      existingLabel.rename(data.name);
    }
    if (data.color !== undefined) {
      existingLabel.recolor(data.color);
    }

    await this.labelRepository.save(existingLabel);
    return existingLabel;
  }

  async delete(id: string): Promise<void> {
    return this.labelRepository.delete(id);
  }
}
