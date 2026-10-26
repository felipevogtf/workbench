import { branchNameFor, parseRepo } from './repo';

describe('parseRepo', () => {
  it('derives the ssh address from the https link', () => {
    expect(parseRepo('https://bitbucket.org/acme/web')).toEqual({
      url: 'https://bitbucket.org/acme/web',
      host: 'bitbucket.org',
      fullName: 'acme/web',
      sshUrl: 'git@bitbucket.org:acme/web.git',
    });
  });

  it('drops a trailing .git', () => {
    expect(parseRepo('https://github.com/acme/web.git').sshUrl).toBe(
      'git@github.com:acme/web.git',
    );
  });

  it.each([
    'no es una url',
    'http://bitbucket.org/acme/web',
    'https://gitlab.com/acme/web',
    'https://bitbucket.org/acme',
    'https://bitbucket.org/acme/web/extra',
    'https://bitbucket.org/-acme/web',
    'https://bitbucket.org/acme/..',
    'https://bitbucket.org/acme/we b',
  ])('rejects %s', (url) => {
    expect(() => parseRepo(url)).toThrow();
  });
});

describe('branchNameFor', () => {
  const id = '1234abcd-0000-0000-0000-000000000000';

  it('makes a readable branch name', () => {
    expect(branchNameFor('Vista de órdenes de carga', id)).toBe(
      'workbench/vista-de-ordenes-de-carga-1234abcd',
    );
  });

  it('never ends up with an invalid name', () => {
    expect(branchNameFor('¡¡¡', id)).toBe('workbench/task-1234abcd');
    expect(branchNameFor('x'.repeat(100), id)).toBe(
      `workbench/${'x'.repeat(40)}-1234abcd`,
    );
    expect(branchNameFor('Arregla -- ../etc', id)).toBe(
      'workbench/arregla-etc-1234abcd',
    );
  });
});
