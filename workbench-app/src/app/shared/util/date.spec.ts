import { formatDay, formatHours, todayIso } from './date';

describe('date helpers', () => {
  it('formats today with the local date parts', () => {
    expect(todayIso(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06');
    expect(todayIso(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('shows a calendar day without shifting it by the time zone', () => {
    expect(formatDay('2026-10-06')).toContain('6');
    expect(formatDay('2026-10-06')).toContain('2026');
  });

  it('shows a dash when there is no valid date', () => {
    expect(formatDay(null)).toBe('—');
    expect(formatDay('hola')).toBe('—');
  });

  it('formats hours', () => {
    expect(formatHours(1.5)).toBe('1,5 h');
    expect(formatHours(null)).toBe('—');
  });
});
