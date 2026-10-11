import { PartialType } from '@nestjs/mapped-types';
import { CreateCredentialItemDto } from './create-credential-item.dto';

/** Todo es opcional: sin `value` se conserva el actual (un valor sensible nunca viaja al cliente). */
export class UpdateCredentialItemDto extends PartialType(
  CreateCredentialItemDto,
) {}
