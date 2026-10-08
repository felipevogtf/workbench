import { bucketHours, bucketTitle, bucketUnit } from './buckets';

describe('bucketUnit', () => {
  it('uses days up to one week', () => {
    expect(bucketUnit({ from: '2026-10-05', to: '2026-10-05' })).toBe('day');
    expect(bucketUnit({ from: '2026-10-05', to: '2026-10-11' })).toBe('day');
  });

  it('uses weeks from more than a week up to four weeks, and for a calendar month', () => {
    expect(bucketUnit({ from: '2026-10-05', to: '2026-10-12' })).toBe('week');
    expect(bucketUnit({ from: '2026-10-05', to: '2026-11-01' })).toBe('week');
    expect(bucketUnit({ from: '2026-10-01', to: '2026-10-31' })).toBe('week');
  });

  it('uses months from more than a month up to twelve months', () => {
    expect(bucketUnit({ from: '2026-10-01', to: '2026-11-01' })).toBe('month');
    expect(bucketUnit({ from: '2026-01-01', to: '2026-12-31' })).toBe('month');
  });

  it('uses years for more than twelve months', () => {
    expect(bucketUnit({ from: '2026-01-01', to: '2027-01-02' })).toBe('year');
  });
});

describe('bucketHours', () => {
  it('lists every day of a week, with zeros for the days without hours', () => {
    const { unit, buckets } = bucketHours({ from: '2026-10-05', to: '2026-10-11' }, [
      { date: '2026-10-06', hours: 2 },
      { date: '2026-10-08', hours: 1.5 },
    ]);

    expect(unit).toBe('day');
    expect(buckets.map((b) => b.key)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(buckets.map((b) => b.hours)).toEqual([0, 2, 0, 1.5, 0, 0, 0]);
  });

  it('groups four weeks by week (Monday to Sunday)', () => {
    const { unit, buckets } = bucketHours({ from: '2026-10-05', to: '2026-11-01' }, [
      { date: '2026-10-05', hours: 1 },
      { date: '2026-10-11', hours: 2 },
      { date: '2026-10-12', hours: 4 },
      { date: '2026-10-30', hours: 8 },
    ]);

    expect(unit).toBe('week');
    expect(buckets.map((b) => [b.key, b.hours])).toEqual([
      ['2026-10-05', 3],
      ['2026-10-12', 4],
      ['2026-10-19', 0],
      ['2026-10-26', 8],
    ]);
  });

  it('clips the first and last week of a calendar month to the month', () => {
    // Octubre de 2026 empieza en jueves y termina en sábado.
    const { buckets } = bucketHours({ from: '2026-10-01', to: '2026-10-31' }, []);

    expect(buckets.map((b) => b.key)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
    expect(buckets[0].label).toBe('1 – 4 oct');
    expect(buckets[4].label).toBe('26 – 31 oct');
  });

  it('groups by month, including the months without hours', () => {
    const { unit, buckets } = bucketHours({ from: '2026-08-15', to: '2026-12-10' }, [
      { date: '2026-08-20', hours: 3 },
      { date: '2026-08-21', hours: 2 },
      { date: '2026-11-02', hours: 6 },
    ]);

    expect(unit).toBe('month');
    expect(buckets.map((b) => [b.key, b.hours])).toEqual([
      ['2026-08', 5],
      ['2026-09', 0],
      ['2026-10', 0],
      ['2026-11', 6],
      ['2026-12', 0],
    ]);
    expect(buckets[0].label).toMatch(/^ago 2026$/);
  });

  it('groups by year when the range is longer than twelve months', () => {
    const { unit, buckets } = bucketHours({ from: '2025-06-01', to: '2027-02-01' }, [
      { date: '2025-07-01', hours: 10 },
      { date: '2026-03-01', hours: 5 },
      { date: '2026-04-01', hours: 0.1 },
      { date: '2026-05-01', hours: 0.2 },
    ]);

    expect(unit).toBe('year');
    expect(buckets.map((b) => [b.label, b.hours])).toEqual([
      ['2025', 10],
      ['2026', 5.3],
      ['2027', 0],
    ]);
  });
});

describe('bucketTitle', () => {
  it('names the unit', () => {
    expect(bucketTitle('day')).toBe('Horas por día');
    expect(bucketTitle('week')).toBe('Horas por semana');
    expect(bucketTitle('month')).toBe('Horas por mes');
    expect(bucketTitle('year')).toBe('Horas por año');
  });
});
