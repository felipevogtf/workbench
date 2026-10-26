import { branchNameFor, branchTypeOf, parseRepo } from './repo';

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
  it('makes a readable branch name that starts with the type, for a local task', () => {
    expect(
      branchNameFor({
        taskName: 'Vista de órdenes de carga',
        type: 'feature',
      }),
    ).toBe('feature/vista-de-ordenes-de-carga');
  });

  it('adds the code of the Plane ticket when the task has one', () => {
    expect(
      branchNameFor({
        taskName: 'Vista de órdenes de carga',
        type: 'feature',
        key: 'MEL-12',
      }),
    ).toBe('feature/MEL-12/vista-de-ordenes-de-carga');
    expect(
      branchNameFor({
        taskName: 'Falla el login',
        type: 'hotfix',
        key: 'SER-3',
      }),
    ).toBe('hotfix/SER-3/falla-el-login');
  });

  it('never repeats the branch of an earlier execution of the same task', () => {
    const data = { taskName: 'Vista', type: 'fix' as const, key: 'MEL-1' };

    expect(branchNameFor({ ...data, attempt: 1 })).toBe('fix/MEL-1/vista');
    expect(branchNameFor({ ...data, attempt: 2 })).toBe('fix/MEL-1/vista-2');
    expect(branchNameFor({ ...data, attempt: 3 })).toBe('fix/MEL-1/vista-3');
  });

  it('never ends up with an invalid name', () => {
    expect(branchNameFor({ taskName: '¡¡¡', type: 'feature' })).toBe(
      'feature/task',
    );
    expect(branchNameFor({ taskName: 'x'.repeat(100), type: 'feature' })).toBe(
      `feature/${'x'.repeat(40)}`,
    );
    expect(branchNameFor({ taskName: 'Arregla -- ../etc', type: 'fix' })).toBe(
      'fix/arregla-etc',
    );
  });

  it('keeps only safe characters of the ticket code', () => {
    expect(
      branchNameFor({
        taskName: 'Vista',
        type: 'feature',
        key: '../MEL 12',
      }),
    ).toBe('feature/MEL12/vista');
  });
});

describe('branchTypeOf', () => {
  it.each([
    ['Vista de órdenes de carga', 'feature'],
    ['Agregar exportación a Excel', 'feature'],
    ['Corregir el cálculo del total', 'fix'],
    ['Arreglar el login', 'fix'],
    ['[BUG] No guarda la patente', 'fix'],
    ['Fix de zona horaria', 'fix'],
    ['Falla al subir la imagen', 'fix'],
    ['Corrección de textos', 'fix'],
    ['Hotfix: el cobro se duplica', 'hotfix'],
    ['HOTFIX login', 'hotfix'],
  ])('«%s» is a %s', (name, type) => {
    expect(branchTypeOf(name)).toBe(type);
  });

  it('does not take a word that only contains one as a fix', () => {
    expect(branchTypeOf('Prefijo en las órdenes')).toBe('feature');
    expect(branchTypeOf('Debugger de integraciones')).toBe('feature');
  });
});
