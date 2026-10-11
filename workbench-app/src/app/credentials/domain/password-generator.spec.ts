import {
  DEFAULT_OPTIONS,
  MAX_LENGTH,
  MIN_LENGTH,
  PasswordOptions,
  activePools,
  generatePassword,
  secureRandomInt,
  strengthOf,
} from './password-generator';

const only = (set: 'uppercase' | 'lowercase' | 'digits' | 'symbols'): PasswordOptions => ({
  ...DEFAULT_OPTIONS,
  uppercase: false,
  lowercase: false,
  digits: false,
  symbols: false,
  [set]: true,
});

describe('generatePassword', () => {
  it('has the requested length', () => {
    expect(generatePassword({ ...DEFAULT_OPTIONS, length: 20 })).toHaveLength(20);
  });

  it('keeps the length within the allowed range', () => {
    expect(generatePassword({ ...DEFAULT_OPTIONS, length: 1 })).toHaveLength(MIN_LENGTH);
    expect(generatePassword({ ...DEFAULT_OPTIONS, length: 500 })).toHaveLength(MAX_LENGTH);
  });

  it('always includes a character of every active set', () => {
    for (let i = 0; i < 200; i++) {
      const password = generatePassword({ ...DEFAULT_OPTIONS, length: MIN_LENGTH });

      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it.each([
    ['uppercase', /^[A-Z]+$/],
    ['lowercase', /^[a-z]+$/],
    ['digits', /^[0-9]+$/],
  ] as const)('uses only the %s set when it is the only one', (set, pattern) => {
    expect(generatePassword(only(set))).toMatch(pattern);
  });

  it('leaves out the ambiguous characters when asked', () => {
    for (let i = 0; i < 200; i++) {
      const password = generatePassword({ ...DEFAULT_OPTIONS, length: 64, avoidAmbiguous: true });

      expect(password).not.toMatch(/[Il1O0]/);
    }
  });

  it('refuses to generate without any character set', () => {
    expect(() =>
      generatePassword({
        ...DEFAULT_OPTIONS,
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: false,
      }),
    ).toThrow(/al menos un tipo/);
  });

  it('draws every character from the random source it is given', () => {
    const calls: number[] = [];
    const randomInt = (max: number) => {
      calls.push(max);
      return 0;
    };

    const password = generatePassword({ ...only('digits'), length: 8 }, randomInt);

    expect(password).toBe('00000000');
    expect(calls.every((max) => max >= 1)).toBe(true);
  });
});

describe('secureRandomInt', () => {
  it('stays within the range and reaches every value', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const value = secureRandomInt(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      seen.add(value);
    }

    expect(seen.size).toBe(6);
  });
});

describe('activePools', () => {
  it('drops the ambiguous characters from each pool', () => {
    const pools = activePools({ ...DEFAULT_OPTIONS, avoidAmbiguous: true });

    expect(pools.join('')).not.toMatch(/[Il1O0]/);
    expect(pools).toHaveLength(4);
  });
});

describe('strengthOf', () => {
  it('grows with the length', () => {
    const short = strengthOf({ ...DEFAULT_OPTIONS, length: 8 });
    const long = strengthOf({ ...DEFAULT_OPTIONS, length: 32 });

    expect(long.bits).toBeGreaterThan(short.bits);
    expect(long.ratio).toBeGreaterThan(short.ratio);
  });

  it('grows with the variety of characters', () => {
    expect(strengthOf(DEFAULT_OPTIONS).bits).toBeGreaterThan(
      strengthOf({ ...DEFAULT_OPTIONS, symbols: false, digits: false }).bits,
    );
  });

  it.each([
    [{ ...only('digits'), length: 8 }, 'weak'],
    [{ ...only('lowercase'), length: 12 }, 'fair'],
    [{ ...DEFAULT_OPTIONS, length: 12 }, 'strong'],
    [DEFAULT_OPTIONS, 'very-strong'],
  ] as const)('classifies %# as %s', (options, level) => {
    expect(strengthOf(options).level).toBe(level);
  });

  it('never goes past a full bar', () => {
    expect(strengthOf({ ...DEFAULT_OPTIONS, length: MAX_LENGTH }).ratio).toBe(1);
  });
});
