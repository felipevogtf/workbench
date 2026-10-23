import { Semaphore } from './semaphore';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}

/** Deja que se resuelvan todas las promesas pendientes. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Semaphore', () => {
  it('runs at most `limit` tasks at the same time and the rest in arrival order', async () => {
    const semaphore = new Semaphore(2);
    const gates = [deferred(), deferred(), deferred(), deferred()];
    const started: number[] = [];
    let running = 0;
    let peak = 0;

    const tasks = gates.map((gate, index) =>
      semaphore.run(async () => {
        started.push(index);
        peak = Math.max(peak, ++running);
        await gate.promise;
        running--;
      }),
    );

    await flush();
    expect(started).toEqual([0, 1]);

    gates[0].release();
    await flush();
    expect(started).toEqual([0, 1, 2]);

    gates[1].release();
    gates[2].release();
    gates[3].release();
    await Promise.all(tasks);

    expect(started).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
  });

  it('frees the turn when a task fails', async () => {
    const semaphore = new Semaphore(1);

    await expect(
      semaphore.run(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    await expect(semaphore.run(() => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
  });
});
