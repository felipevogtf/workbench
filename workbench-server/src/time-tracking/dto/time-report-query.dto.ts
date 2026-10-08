import { Matches } from 'class-validator';

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
}
