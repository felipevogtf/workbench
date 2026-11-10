/** Horas registradas en un rango de fechas, tal como las devuelve el servidor. */
export interface TimeReport {
  from: string;
  to: string;
  totalHours: number;
  /** Solo los días que tienen horas. */
  byDay: DayHours[];
  /** Las tareas con horas, de la que más tiene a la que menos. */
  byIssue: IssueHours[];
  /** Qué tareas tuvieron horas cada día. */
  byDayIssue: DayIssueHours[];
}

export interface DayHours {
  date: string;
  hours: number;
}

export interface IssueHours {
  issueId: string;
  hours: number;
}

export interface DayIssueHours extends IssueHours {
  date: string;
}
