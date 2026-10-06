import { timeAgo } from './time-ago';

describe('timeAgo', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it('returns a dash for missing or invalid dates', () => {
    expect(timeAgo(null, now)).toBe('—');
    expect(timeAgo(undefined, now)).toBe('—');
    expect(timeAgo('not a date', now)).toBe('—');
  });

  it.each([
    [10, 'hace unos segundos'],
    [5 * 60, 'hace 5 min'],
    [3 * 3600, 'hace 3 h'],
    [2 * 86400, 'hace 2 d'],
  ])('formats %i seconds ago', (seconds, expected) => {
    expect(timeAgo(ago(seconds), now)).toBe(expected);
  });

  it('shows the date after a week', () => {
    expect(timeAgo(ago(30 * 86400), now)).not.toContain('hace');
  });
});
