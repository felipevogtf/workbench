import { TimeEntry } from '@time-tracking/domain/entities/time-entry.entity';
import {
  buildTimeReport,
  MAX_REPORT_DAYS,
  validateReportRange,
} from './time-report';

const entry = (issueId: string, hours: number, date: string) =>
  TimeEntry.create({ issueId, hours, date });

describe('buildTimeReport', () => {
  it('totals the hours and groups them by day and by issue', () => {
    const report = buildTimeReport('2026-10-05', '2026-10-11', [
      entry('a', 1.5, '2026-10-07'),
      entry('a', 2, '2026-10-07'),
      entry('b', 4, '2026-10-05'),
      entry('a', 1, '2026-10-09'),
    ]);

    expect(report).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
      totalHours: 8.5,
      byDay: [
        { date: '2026-10-05', hours: 4 },
        { date: '2026-10-07', hours: 3.5 },
        { date: '2026-10-09', hours: 1 },
      ],
      byIssue: [
        { issueId: 'a', hours: 4.5 },
        { issueId: 'b', hours: 4 },
      ],
    });
  });

  it('does not accumulate floating point noise', () => {
    const report = buildTimeReport('2026-10-05', '2026-10-05', [
      entry('a', 0.1, '2026-10-05'),
      entry('a', 0.2, '2026-10-05'),
    ]);

    expect(report.totalHours).toBe(0.3);
    expect(report.byDay[0].hours).toBe(0.3);
  });

  it('returns an empty report when there are no entries', () => {
    expect(buildTimeReport('2026-10-05', '2026-10-11', [])).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
      totalHours: 0,
      byDay: [],
      byIssue: [],
    });
  });
});

describe('validateReportRange', () => {
  it('accepts a single day and up to ten years', () => {
    expect(() => validateReportRange('2026-10-05', '2026-10-05')).not.toThrow();
    expect(() => validateReportRange('2026-01-01', '2026-12-31')).not.toThrow();
    expect(() => validateReportRange('2016-01-01', '2025-12-31')).not.toThrow();
  });

  it('rejects dates that are not real', () => {
    expect(() => validateReportRange('2026-02-30', '2026-03-01')).toThrow(
      'from must be a valid date',
    );
    expect(() => validateReportRange('2026-10-05', 'hoy')).toThrow(
      'to must be a valid date',
    );
  });

  it('rejects a range that starts after it ends', () => {
    expect(() => validateReportRange('2026-10-06', '2026-10-05')).toThrow(
      'from must not be after to',
    );
  });

  it('rejects a range longer than ten years', () => {
    expect(() => validateReportRange('2000-01-01', '2026-01-01')).toThrow(
      `${MAX_REPORT_DAYS} days`,
    );
  });
});
