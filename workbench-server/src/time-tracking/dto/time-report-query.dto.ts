import { IsIn, IsOptional, Matches } from 'class-validator';

export class TimeReportQueryDto {
  /** Primer día del rango, `YYYY-MM-DD`. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must use the YYYY-MM-DD format',
  })
  from!: string;

  /** Último día del rango (incluido), `YYYY-MM-DD`. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must use the YYYY-MM-DD format',
  })
  to!: string;

  /** `false` deja fuera las horas de tareas locales. Sin definir (o `true`) cuentan todas. */
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'includeLocal must be true or false' })
  includeLocal?: string;
}
