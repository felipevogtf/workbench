import { DomainError } from '@core/domain/domain.error';
import { normalizeRepoUrl } from './repo-url';

describe('normalizeRepoUrl', () => {
  it.each([
    [
      'https://github.com/garage-labs/melon-web',
      'https://github.com/garage-labs/melon-web',
    ],
    [
      'https://github.com/garage-labs/melon-web.git',
      'https://github.com/garage-labs/melon-web',
    ],
    ['  https://bitbucket.org/ws/app/  ', 'https://bitbucket.org/ws/app'],
  ])('accepts and normalizes %s', (input, expected) => {
    expect(normalizeRepoUrl(input)).toBe(expected);
  });

  it.each([
    'no es una url',
    'http://github.com/a/b',
    'https://gitlab.com/a/b',
    'https://user:pass@github.com/a/b',
    'https://github.com:444/a/b',
    'https://github.com/a',
    'https://github.com/a/b/c',
    'https://github.com/-evil/repo',
    'https://github.com/a/..',
    'ssh://git@github.com/a/b',
  ])('rejects %s', (input) => {
    expect(() => normalizeRepoUrl(input)).toThrow(DomainError);
  });
});
