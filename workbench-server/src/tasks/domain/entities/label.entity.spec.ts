import { LABEL_COLORS, randomLabelColor } from '@tasks/domain/label-colors';
import { Label } from './label.entity';

describe('Label color', () => {
  it('keeps the color it is given', () => {
    expect(Label.create({ name: 'bug', color: '#123456' }).color).toBe(
      '#123456',
    );
  });

  it('gets a color from the palette when none is given', () => {
    const label = Label.create({ name: 'bug' });
    expect(LABEL_COLORS).toContain(label.color);
  });

  it('also when the color comes empty (null)', () => {
    expect(LABEL_COLORS).toContain(
      Label.create({ name: 'bug', color: null }).color,
    );
  });

  it('picks any color of the palette depending on the random value', () => {
    expect(randomLabelColor(() => 0)).toBe(LABEL_COLORS[0]);
    expect(randomLabelColor(() => 0.999)).toBe(
      LABEL_COLORS[LABEL_COLORS.length - 1],
    );
  });
});
