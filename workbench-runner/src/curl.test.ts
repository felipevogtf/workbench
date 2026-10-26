import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkCurlArgs } from './curl';

describe('checkCurlArgs', () => {
  it('lets through the usual ways of testing a route', () => {
    for (const args of [
      ['http://localhost:20031/'],
      ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:1/x'],
      ['-si', 'http://localhost:1/x'],
      [
        '-X',
        'POST',
        '-H',
        'Content-Type: application/json',
        '-d',
        '{"a":1}',
        'http://localhost:1/x',
      ],
      ['-F', 'file=@x.csv', 'http://localhost:1/secured/admin/ea'],
      ['-so', '/dev/null', 'http://localhost:1/'],
      ['--output', '/dev/null', 'http://localhost:1/'],
      ['--output=/dev/null', 'http://localhost:1/'],
      ['-D', '-', 'http://localhost:1/'],
    ]) {
      assert.equal(checkCurlArgs(args), null, args.join(' '));
    }
  });

  it('rejects the options that change where it connects or read configuration', () => {
    for (const args of [
      ['-x', 'http://proxy:3128', 'http://localhost:1/'],
      ['-sx', 'http://proxy:3128', 'http://localhost:1/'],
      ['--proxy', 'http://proxy:3128', 'http://localhost:1/'],
      ['--proxy=http://proxy:3128', 'http://localhost:1/'],
      ['--socks5', 'host:1', 'http://localhost:1/'],
      ['-K', 'cfg', 'http://localhost:1/'],
      ['--config', 'cfg', 'http://localhost:1/'],
      ['--next', 'http://localhost:1/'],
      ['--resolve', 'a:80:1.2.3.4', 'http://localhost:1/'],
      ['--connect-to', 'a:80:b:80', 'http://localhost:1/'],
      [
        '--unix-socket',
        '/var/run/docker.sock',
        'http://localhost/containers/json',
      ],
    ]) {
      assert.match(
        checkCurlArgs(args) ?? '',
        /no está permitida/,
        args.join(' '),
      );
    }
  });

  it('only lets it write to /dev/null', () => {
    for (const args of [
      ['-o', '/home/agent/.ssh/authorized_keys', 'http://localhost:1/'],
      ['-so', 'x', 'http://localhost:1/'],
      ['--output', 'x', 'http://localhost:1/'],
      ['--output=x', 'http://localhost:1/'],
      ['-D', 'headers.txt', 'http://localhost:1/'],
      ['-c', 'jar.txt', 'http://localhost:1/'],
      ['--cookie-jar', 'jar.txt', 'http://localhost:1/'],
      ['-o'],
    ]) {
      assert.match(
        checkCurlArgs(args) ?? '',
        /solo puede escribir en \/dev\/null/,
        args.join(' '),
      );
    }
  });

  it('rejects downloads that name the file after the remote one, and uploads of files', () => {
    for (const args of [
      ['-O', 'http://localhost:1/a'],
      ['-J', 'http://localhost:1/a'],
      ['-T', 'f', 'http://localhost:1/a'],
      ['--upload-file', 'f', 'http://localhost:1/a'],
      ['--remote-name', 'http://localhost:1/a'],
    ]) {
      assert.notEqual(checkCurlArgs(args), null, args.join(' '));
    }
  });
});
