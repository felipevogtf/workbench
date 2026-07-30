// tasks/domain/ports/label-repository.port.ts
import { Label } from '@tasks/domain/entities/label.entity';

export interface LabelRepositoryPort {
  findById(id: string): Promise<Label | null>;
  findByIds(ids: string[]): Promise<Label[]>;
  findAll(): Promise<Label[]>;
  save(label: Label): Promise<Label>;
  delete(id: string): Promise<void>;
}

export const LABEL_REPOSITORY_PORT = Symbol('LABEL_REPOSITORY_PORT');
