import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentDto } from './create-agent.dto';

// isDefault no se edita por PATCH: se cambia con POST /agents/:id/default.
export class UpdateAgentDto extends PartialType(CreateAgentDto) {}
