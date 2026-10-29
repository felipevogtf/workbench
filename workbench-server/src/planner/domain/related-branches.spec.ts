import {
  branchHasKey,
  headsOf,
  pickBranches,
  relatedKeysOf,
} from './related-branches';

describe('relatedKeysOf', () => {
  it('finds the ticket keys in the texts, once each and in order', () => {
    expect(
      relatedKeysOf([
        'Mostrar el bloqueo (MEL-466)',
        'La rama MEL-466 del backend, y también SER-3. MEL-466 otra vez',
        null,
        undefined,
      ]),
    ).toEqual(['MEL-466', 'SER-3']);
  });

  it('ignores what only looks like a key', () => {
    expect(relatedKeysOf(['UTF-8, iso-8859-1, mel-466, A-1'])).toEqual([
      'UTF-8',
    ]);
  });

  it('keeps only a few', () => {
    const keys = relatedKeysOf(['A1-1 A1-2 A1-3 A1-4 A1-5 A1-6']);
    expect(keys).toEqual(['A1-1', 'A1-2', 'A1-3', 'A1-4']);
  });
});

describe('branchHasKey', () => {
  it.each([
    ['feature/MEL-466/mejora-micamion', 'MEL-466', true],
    ['MEL-466', 'MEL-466', true],
    ['fix/mel-466-algo', 'MEL-466', true],
    ['feature/MEL-4660/x', 'MEL-466', false],
    ['feature/XMEL-466/x', 'MEL-466', false],
    ['feature/MEL-46/x', 'MEL-466', false],
  ])('%s with %s -> %s', (branch, key, expected) => {
    expect(branchHasKey(branch, key)).toBe(expected);
  });
});

describe('pickBranches', () => {
  const heads = [
    'main',
    'master',
    'feature/MEL-466/mejora',
    'feature/MEL-466/otra',
    'feature/MEL-500/x',
    '-feature/MEL-466',
    'feature/MEL-466/raro;rm',
  ];

  it('takes the branches that carry a key, never the main ones nor unsafe names', () => {
    expect(pickBranches(heads, ['MEL-466'])).toEqual([
      { key: 'MEL-466', branch: 'feature/MEL-466/mejora' },
      { key: 'MEL-466', branch: 'feature/MEL-466/otra' },
    ]);
  });

  it('stays within the limit', () => {
    const many = Array.from({ length: 8 }, (_, i) => `feature/MEL-1/${i}`);
    expect(pickBranches(many, ['MEL-1'])).toHaveLength(3);
  });

  it('gives nothing when no branch matches', () => {
    expect(pickBranches(heads, ['MEL-999'])).toEqual([]);
  });
});

describe('headsOf', () => {
  it('reads the branch names out of git ls-remote', () => {
    const out =
      'abc123\trefs/heads/main\ndef456\trefs/heads/feature/MEL-466/x\n789\trefs/tags/v1\n';
    expect(headsOf(out)).toEqual(['main', 'feature/MEL-466/x']);
  });
});
