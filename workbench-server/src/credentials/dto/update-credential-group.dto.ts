import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateCredentialGroupDto } from './create-credential-group.dto';

export class UpdateCredentialGroupDto extends PartialType(
  PickType(CreateCredentialGroupDto, ['name', 'category'] as const),
) {}
