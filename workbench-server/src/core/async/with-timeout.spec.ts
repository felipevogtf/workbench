import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('resolves with the value when it arrives in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
  });

  it('rejects when it takes too long', async () => {
    const slow = new Promise<number>((resolve) =>
      setTimeout(() => resolve(1), 200),
    );
    await expect(withTimeout(slow, 10)).rejects.toThrow(
      'Timed out after 10 ms',
    );
  });

  it('passes the original error through', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 100),
    ).rejects.toThrow('boom');
  });

  it('wraps a rejection that is not an Error', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    await expect(withTimeout(Promise.reject('texto'), 100)).rejects.toThrow(
      'texto',
    );
  });
});
