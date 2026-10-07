import { ExternalSource } from '@tasks/domain/entities/project.props';

export class ProjectResponseDto {
  id!: string;
  name!: string;
  externalId!: string | null;
  source!: ExternalSource | null;
  identifier!: string | null;
  syncedAt!: string | null;
  createdAt!: string;
}
