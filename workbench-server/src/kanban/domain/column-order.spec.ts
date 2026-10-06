import { COLUMN_POSITION_STEP, insertAt, positionAt } from './column-order';

describe('column order', () => {
  it('inserts at the requested index without touching the original', () => {
    const column = ['a', 'b', 'c'];
    expect(insertAt(column, 'x', 1)).toEqual(['a', 'x', 'b', 'c']);
    expect(column).toEqual(['a', 'b', 'c']);
  });

  it('clamps an index outside the column', () => {
    expect(insertAt(['a'], 'x', 99)).toEqual(['a', 'x']);
    expect(insertAt(['a'], 'x', -3)).toEqual(['x', 'a']);
  });

  it('works on an empty column', () => {
    expect(insertAt([], 'x', 0)).toEqual(['x']);
  });

  it('spaces positions by the step, starting at one step', () => {
    expect(positionAt(0)).toBe(COLUMN_POSITION_STEP);
    expect(positionAt(2)).toBe(3 * COLUMN_POSITION_STEP);
  });
});
