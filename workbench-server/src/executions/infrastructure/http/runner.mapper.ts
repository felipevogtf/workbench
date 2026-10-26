import { Runner } from '@executions/domain/entities/runner.entity';
import { RunnerResponseDto } from '@executions/dto/runner.dto';

export function toRunnerDto(runner: Runner): RunnerResponseDto {
  return {
    id: runner.id,
    name: runner.name,
    version: runner.version,
    host: runner.host,
    lastSeenAt: runner.lastSeenAt?.toISOString() ?? null,
    online: runner.isOnline(),
    isDefault: runner.isDefault,
    createdAt: runner.createdAt.toISOString(),
  };
}
