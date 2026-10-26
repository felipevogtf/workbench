import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  JobKind,
  JobPayload,
  JobResult,
} from '@executions/domain/entities/job.props';

export class CreateRunnerDto {
  @IsString()
  @MaxLength(60)
  name!: string;
}

export class RunnerResponseDto {
  id!: string;
  name!: string;
  version!: string | null;
  host!: string | null;
  lastSeenAt!: string | null;
  online!: boolean;
  /** El runner que toma el trabajo primero y al que la app intenta despertar. */
  isDefault!: boolean;
  createdAt!: string;
}

export class CreatedRunnerDto extends RunnerResponseDto {
  /** Solo se muestra una vez, al crear el runner. */
  token!: string;
}

export class RunnerHelloDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  host?: string;
}

export class RunnerHeartbeatDto {
  @IsArray()
  @IsString({ each: true })
  runningJobIds!: string[];
}

export class RunnerLogsDto {
  @IsString()
  @MaxLength(100_000)
  text!: string;
}

export class RunnerResultDto {
  @IsBoolean()
  ok!: boolean;

  @IsOptional()
  @IsObject()
  result?: JobResult;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  error?: string;

  @IsOptional()
  @IsNumber()
  costUsd?: number;
}

/** Un trabajo tal como lo recibe el runner. */
export class RunnerJobDto {
  id!: string;
  executionId!: string;
  kind!: JobKind;
  attempt!: number;
  payload!: JobPayload;
}
