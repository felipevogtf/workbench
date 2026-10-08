export class TimeReportResponseDto {
  from!: string;
  to!: string;
  totalHours!: number;
  byDay!: { date: string; hours: number }[];
  byIssue!: { issueId: string; hours: number }[];
}
