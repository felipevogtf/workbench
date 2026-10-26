import {
  ExecutionUsage,
  NO_USAGE,
  describeUsage,
  formatFraction,
  formatPoints,
  formatTokens,
  untilText,
} from './usage';

const NOW = Date.parse('2026-10-26T00:00:00Z');
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

describe('formatting the consumption', () => {
  it('writes tokens with the thousands separated', () => {
    expect(formatTokens(412000)).toBe('412.000');
    expect(formatTokens(0)).toBe('0');
  });

  it('writes a fraction of the window as a percentage', () => {
    expect(formatFraction(0.24)).toBe('24 %');
    expect(formatFraction(1)).toBe('100 %');
  });

  it('writes estimated points with one decimal when small, and "< 0,1 %" when tiny', () => {
    expect(formatPoints(0.04)).toBe('< 0,1 %');
    expect(formatPoints(0.8)).toBe('≈ 0,8 %');
    expect(formatPoints(6.24)).toBe('≈ 6,2 %');
    expect(formatPoints(14.6)).toBe('≈ 15 %');
  });

  it('says how long is left until a reset', () => {
    expect(untilText(at(12), NOW)).toBe('en 12 min');
    expect(untilText(at(265), NOW)).toBe('en 4 h 25 min');
    expect(untilText(at(120), NOW)).toBe('en 2 h');
    expect(untilText(at(60 * 55), NOW)).toBe('en 2 d 7 h');
    expect(untilText(at(-5), NOW)).toBe('ya se reinició');
  });
});

describe('describeUsage', () => {
  const usage = (extra: Partial<ExecutionUsage> = {}): ExecutionUsage => ({
    ...NO_USAGE,
    tokens: { input: 100, output: 200, cacheWrite: 3000, cacheRead: 400000, total: 403300 },
    costUsd: 1.2,
    ...extra,
  });

  it('says nothing for an execution that was not measured', () => {
    expect(describeUsage(undefined)).toBeNull();
    expect(describeUsage(NO_USAGE)).toBeNull();
  });

  it('gives the exact tokens, and the detail by type of token', () => {
    const text = describeUsage(usage())!;

    expect(text.tokens).toBe('403.300 tokens');
    expect(text.detail).toContain('Entrada 100');
    expect(text.detail).toContain('caché leída 400.000');
  });

  it('gives the estimated share of both windows when it can estimate', () => {
    const text = describeUsage(usage({ estimatedPoints: { fiveHour: 6.2, sevenDay: 0.8 } }))!;

    expect(text.estimate).toBe('≈ 6,2 % de tu ventana de 5 h · ≈ 0,8 % de la semana');
    expect(text.detail).toContain('es una estimación');
  });

  it('says it will estimate later when there is nothing to calibrate with', () => {
    const text = describeUsage(usage())!;

    expect(text.estimate).toBeNull();
    expect(text.detail).toContain('al menos 2 ejecuciones medidas');
  });

  it('shows what the bar rose, warning that it includes any other use of the account', () => {
    const text = describeUsage(
      usage({ measured: { fiveHour: { from: 0.24, to: 0.31, delta: 0.07 }, sevenDay: null } }),
    )!;

    expect(text.measured).toContain('del 24 % al 31 %');
    expect(text.measured).toContain('otro uso de tu cuenta');
  });
});
