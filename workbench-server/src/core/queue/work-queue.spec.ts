import { WorkQueue } from './work-queue';

/** Cola en memoria: `claim` saca de `pending`. */
function build(options: { concurrency?: number; fail?: boolean } = {}) {
  const pending: string[] = [];
  const done: string[] = [];
  let running = 0;
  let maxRunning = 0;

  const queue = new WorkQueue<string>({
    name: 'test',
    concurrency: options.concurrency ?? 1,
    claim: () => Promise.resolve(pending.shift() ?? null),
    process: async (item) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      if (options.fail && item === 'boom') throw new Error('crash');
      done.push(item);
    },
  });
  return { queue, pending, done, maxRunning: () => maxRunning };
}

const idle = async (queue: WorkQueue<string>) => {
  for (let i = 0; i < 100 && queue.activeWorkers > 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

describe('WorkQueue', () => {
  it('processes everything that is queued', async () => {
    const { queue, pending, done } = build();
    pending.push('a', 'b', 'c');

    queue.kick();
    await idle(queue);

    expect(done).toEqual(['a', 'b', 'c']);
  });

  it('never runs more workers than the concurrency', async () => {
    const { queue, pending, done, maxRunning } = build({ concurrency: 2 });
    pending.push('a', 'b', 'c', 'd', 'e');

    queue.kick();
    queue.kick();
    await idle(queue);

    expect(done).toHaveLength(5);
    expect(maxRunning()).toBe(2);
  });

  it('picks up what is queued while the workers are busy', async () => {
    const { queue, pending, done } = build();
    pending.push('a');
    queue.kick();

    pending.push('b');
    queue.kick();
    await idle(queue);

    expect(done).toEqual(['a', 'b']);
  });

  it('frees the worker when processing crashes, so the queue can start again', async () => {
    const { queue, pending, done } = build({ fail: true });
    pending.push('boom');
    queue.kick();
    await idle(queue);
    expect(queue.activeWorkers).toBe(0);

    pending.push('ok');
    queue.kick();
    await idle(queue);
    expect(done).toEqual(['ok']);
  });
});
