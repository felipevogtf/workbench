import { IsNumber, IsUUID, Matches, Max, Min } from 'class-validator';

export class CreateTimeEntryDto {
  @IsUUID()
  issueId!: string;

  @IsNumber()
  @Min(0.01)
  @Max(24)
  hours!: number;

  /** `YYYY-MM-DD`. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must use the YYYY-MM-DD format',
  })
  date!: string;
}
