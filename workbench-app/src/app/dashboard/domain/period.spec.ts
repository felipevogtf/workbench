import {
  addDays,
  eachDay,
  isValidRange,
  monthRange,
  periodLabel,
  shiftAnchor,
  weekRange,
} from './period';

describe('weekRange', () => {
  it('goes from Monday to Sunday for any day of the week', () => {
    // 2026-10-05 es lunes; 2026-10-11 es domingo.
    for (const day of ['2026-10-05', '2026-10-08', '2026-10-11']) {
      expect(weekRange(day)).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    }
  });

  it('crosses months and years', () => {
    expect(weekRange('2026-09-30')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(weekRange('2027-01-01')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });
});

describe('monthRange', () => {
  it('covers the whole month, including leap years', () => {
    expect(monthRange('2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('shiftAnchor', () => {
  it('moves a week at a time', () => {
    expect(shiftAnchor('week', '2026-10-08', 1)).toBe('2026-10-15');
    expect(shiftAnchor('week', '2026-10-08', -1)).toBe('2026-10-01');
  });

  it('moves a month at a time without skipping a short month', () => {
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftAnchor('month', '2026-01-31', -1)).toBe('2025-12-01');
  });
});

describe('eachDay', () => {
  it('lists every day of the range in order', () => {
    expect(eachDay({ from: '2026-10-30', to: '2026-11-02' })).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('lists a single day', () => {
    expect(eachDay({ from: '2026-10-05', to: '2026-10-05' })).toEqual(['2026-10-05']);
  });
});

describe('addDays', () => {
  it('survives daylight saving changes', () => {
    expect(addDays('2026-04-04', 1)).toBe('2026-04-05');
    expect(addDays('2026-09-05', 1)).toBe('2026-09-06');
  });
});

describe('isValidRange', () => {
  it('accepts a day and a full year', () => {
    expect(isValidRange({ from: '2026-10-05', to: '2026-10-05' })).toBe(true);
    expect(isValidRange({ from: '2026-01-01', to: '2026-12-31' })).toBe(true);
  });

  it('rejects empty, unreal, reversed and too long ranges', () => {
    expect(isValidRange({ from: '', to: '2026-10-05' })).toBe(false);
    expect(isValidRange({ from: '2026-02-30', to: '2026-03-01' })).toBe(false);
    expect(isValidRange({ from: '2026-10-06', to: '2026-10-05' })).toBe(false);
    expect(isValidRange({ from: '2026-01-01', to: '2027-01-02' })).toBe(false);
  });
});

describe('periodLabel', () => {
  it('writes the week, the month and a free range', () => {
    expect(periodLabel('week', { from: '2026-10-05', to: '2026-10-11' })).toBe('5 – 11 oct 2026');
    expect(periodLabel('week', { from: '2026-09-28', to: '2026-10-04' })).toMatch(
      /^28 sep[a-z.]* – 4 oct 2026$/,
    );
    expect(periodLabel('month', { from: '2026-10-01', to: '2026-10-31' })).toBe('Octubre de 2026');
    expect(periodLabel('range', { from: '2026-10-05', to: '2026-10-12' })).toBe(
      '5 oct 2026 – 12 oct 2026',
    );
  });
});
