import { compareToEstimate } from './estimate-comparison';
import { WorkedProject } from './group-by-project';

const project = (issues: [number, number | null][]): WorkedProject => ({
  id: 'p1',
  name: 'Melón',
  totalHours: issues.reduce((sum, [hours]) => sum + hours, 0),
  issues: issues.map(([hours, estimatedHours], index) => ({
    id: `i${index}`,
    name: `T${index}`,
    code: `MEL-${index}`,
    hours,
    estimatedHours,
  })),
});

describe('compareToEstimate', () => {
  it('compares only the tickets that have an estimate, so the comparison is fair', () => {
    const result = compareToEstimate([
      project([
        [3, 4],
        [2, 1],
        [10, null],
      ]),
    ]);

    expect(result).toEqual({ estimatedHours: 5, workedHours: 5, estimatedTickets: 2, tickets: 3 });
  });

  it('adds up several projects', () => {
    const result = compareToEstimate([project([[1.5, 2]]), project([[2.25, 3]])]);

    expect(result.workedHours).toBe(3.75);
    expect(result.estimatedHours).toBe(5);
  });

  it('has nothing to compare without estimates', () => {
    expect(compareToEstimate([project([[3, null]])]).estimatedTickets).toBe(0);
    expect(compareToEstimate([]).tickets).toBe(0);
  });
});
