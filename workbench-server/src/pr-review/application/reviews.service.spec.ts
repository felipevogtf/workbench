import { NotFoundException } from '@nestjs/common';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { PullRequestCommentPort } from '@pr-review/domain/ports/pull-request-comment.port';
import { AgentsGatewayPort } from '@pr-review/domain/ports/agents-gateway.port';
import { RepositoryCheckoutPort } from '@pr-review/domain/ports/repository-checkout.port';
import { ReviewStoragePort } from '@pr-review/domain/ports/review-storage.port';
import { TicketsGatewayPort } from '@pr-review/domain/ports/tickets-gateway.port';
import { PullRequestSourcePort } from '@pr-review/domain/ports/pull-request-source.port';
import { ReviewsService } from './reviews.service';
import {
  fakeTickets,
  InMemoryPullRequestRepository,
  InMemoryReviewRepository,
  remotePullRequest,
  sleep,
  waitFor,
} from './testing/fakes';

interface Harness {
  service: ReviewsService;
  prs: InMemoryPullRequestRepository;
  reviews: InMemoryReviewRepository;
  runs: string[];
  prompts: string[];
  tickets: ReturnType<typeof fakeTickets>;
  source: { getPullRequest: jest.Mock };
  stats: { inFlight: number; maxInFlight: number };
  disposed: string[];
  comments: string[];
  agents: { runReview: jest.Mock };
  commentPort: { postComment: jest.Mock };
}

function build(
  options: {
    concurrency?: number;
    runDelayMs?: number;
    gate?: Promise<void>;
    tickets?: Partial<TicketsGatewayPort>;
    checkoutCommit?: string;
    provider?: Partial<PullRequestSourcePort>;
  } = {},
): Harness {
  const prs = new InMemoryPullRequestRepository();
  const reviews = new InMemoryReviewRepository();
  const runs: string[] = [];
  const prompts: string[] = [];
  const tickets = fakeTickets(options.tickets);
  const disposed: string[] = [];
  const comments: string[] = [];
  const stats = { inFlight: 0, maxInFlight: 0 };

  const checkout: RepositoryCheckoutPort = {
    checkout: (pr: PullRequest) =>
      Promise.resolve({
        path: `/tmp/${pr.externalId}`,
        commit: options.checkoutCommit ?? `head-${pr.externalId}`,
        dispose: () => {
          disposed.push(pr.externalId);
          return Promise.resolve();
        },
      }),
  };

  const storage: ReviewStoragePort = {
    save: (pr, commit) => Promise.resolve(`${pr.externalId}-${commit}.md`),
    read: (docPath) => Promise.resolve(`# contenido de ${docPath}`),
  };

  const runReview = jest.fn(
    async (request: { prompt: string; agentId?: string; model?: string }) => {
      stats.inFlight++;
      stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
      runs.push(request.prompt.split('\n')[0]);
      prompts.push(request.prompt);
      await options.gate;
      await sleep(options.runDelayMs ?? 5);
      stats.inFlight--;
      return {
        markdown: '## Resumen',
        agentId: request.agentId ?? 'default-agent',
        agentName: 'default-reviewer',
        model: request.model ?? 'claude-sonnet-5-5',
      };
    },
  );
  const agents = { runReview } as AgentsGatewayPort & { runReview: jest.Mock };

  const postComment = jest.fn((repo: string, id: string) => {
    comments.push(`${repo}#${id}`);
    return Promise.resolve(`https://example.test/comment/${id}`);
  });
  const source = {
    provider: 'bitbucket',
    getReviewRequestedPullRequests: jest.fn(),
    getPullRequest: jest.fn().mockResolvedValue(null),
    ...options.provider,
  } as unknown as PullRequestSourcePort & { getPullRequest: jest.Mock };

  const commentPort = {
    provider: 'bitbucket',
    postComment,
  } as PullRequestCommentPort & { postComment: jest.Mock };

  const service = new ReviewsService(
    prs,
    reviews,
    checkout,
    storage,
    agents,
    [commentPort],
    [source],
    tickets,
    options.concurrency ?? 1,
  );

  return {
    service,
    prs,
    reviews,
    runs,
    prompts,
    tickets,
    source,
    stats,
    disposed,
    comments,
    agents,
    commentPort,
  };
}

async function addPending(
  h: Harness,
  externalId: string,
  overrides: Parameters<typeof remotePullRequest>[2] = {},
) {
  const pr = PullRequest.createFromRemote(
    remotePullRequest(externalId, 'ws/app', overrides),
  );
  await h.prs.save(pr);
  // Los queued_at deben distinguirse para fijar el orden de la cola.
  await sleep(2);
  return pr;
}

const allDone = (h: Harness) =>
  [...h.prs.items.values()].every(
    (pr) => pr.status !== 'pending' && pr.status !== 'reviewing',
  ) && (h.service as unknown as { activeWorkers: number }).activeWorkers === 0;

describe('ReviewsService queue', () => {
  it('reviews pending pull requests one at a time by default', async () => {
    const h = build({ concurrency: 1 });
    await addPending(h, '1');
    await addPending(h, '2');
    await addPending(h, '3');

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(h.stats.maxInFlight).toBe(1);
    expect(h.runs).toEqual(['# PR #1: PR 1', '# PR #2: PR 2', '# PR #3: PR 3']);
    expect([...h.prs.items.values()].map((pr) => pr.status)).toEqual([
      'reviewed',
      'reviewed',
      'reviewed',
    ]);
  });

  it('respects a higher configured concurrency', async () => {
    const h = build({ concurrency: 2, runDelayMs: 20 });
    for (const id of ['1', '2', '3', '4']) await addPending(h, id);

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(h.stats.maxInFlight).toBe(2);
    expect(h.runs).toHaveLength(4);
  });

  it('keeps one in progress and the rest pending while it works', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = build({ concurrency: 1, gate });
    await addPending(h, '1');
    await addPending(h, '2');

    h.service.kick();
    await waitFor(() => h.runs.length === 1);

    const queue = await h.service.getQueue();
    expect(queue.reviewing.map((pr) => pr.externalId)).toEqual(['1']);
    expect(queue.pending.map((pr) => pr.externalId)).toEqual(['2']);

    release();
    await waitFor(() => allDone(h));
  });

  it('puts a manual re-review at the end of the queue', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = build({ concurrency: 1, gate });
    const done = PullRequest.createFromRemote(remotePullRequest('9'));
    done.markReviewing();
    done.markReviewed({ commit: 'old', docPath: 'old.md' });
    await h.prs.save(done);
    await addPending(h, '1');
    await addPending(h, '2');

    h.service.kick();
    await waitFor(() => h.runs.length === 1); // PR 1 en curso

    const requeued = await h.service.reReview(done.id, { model: 'opus' });
    expect(requeued.status).toBe('pending');

    const queue = await h.service.getQueue();
    expect(queue.pending.map((pr) => pr.externalId)).toEqual(['2', '9']);

    release();
    await waitFor(() => allDone(h));
    expect(h.runs).toEqual(['# PR #1: PR 1', '# PR #2: PR 2', '# PR #9: PR 9']);
    // El override pedido llegó al agente.
    expect(h.agents.runReview).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: 'opus' }),
    );
  });

  it('does not pick up closed pull requests', async () => {
    const h = build();
    const pr = await addPending(h, '1');
    pr.markClosed();

    h.service.kick();
    await sleep(30);

    expect(h.runs).toHaveLength(0);
    expect(pr.status).toBe('pending');
  });

  it('rejects a re-review while the pull request is being reviewed', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const h = build({ gate });
    const pr = await addPending(h, '1');

    h.service.kick();
    await waitFor(() => h.runs.length === 1);

    await expect(h.service.reReview(pr.id)).rejects.toMatchObject({
      kind: 'conflict',
    });

    release();
    await waitFor(() => allDone(h));
  });

  it('throws NotFound for an unknown pull request', async () => {
    const h = build();

    await expect(h.service.reReview('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ReviewsService execution', () => {
  it('saves the review, comments on the pull request and marks it reviewed', async () => {
    const h = build();
    const pr = await addPending(h, '1');

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(pr.status).toBe('reviewed');
    expect(pr.reviewedCommit).toBe('head-1');
    expect(pr.reviewDocUrl).toBe('1-head-1.md');
    expect(h.comments).toEqual(['ws/app#1']);
    expect(h.reviews.items).toHaveLength(1);
    expect(h.reviews.items[0]).toMatchObject({
      status: 'ok',
      commentStatus: 'posted',
      agentName: 'default-reviewer',
    });
    expect(h.disposed).toEqual(['1']);
  });

  it('keeps the review when the comment fails and allows retrying it', async () => {
    const h = build();
    h.commentPort.postComment.mockRejectedValueOnce(new Error('403 forbidden'));
    const pr = await addPending(h, '1');

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(pr.status).toBe('reviewed');
    expect(h.reviews.items[0].commentStatus).toBe('failed');
    expect(h.reviews.items[0].commentError).toContain('403');

    const retried = await h.service.retryComment(pr.id);

    expect(retried.commentStatus).toBe('posted');
    expect(h.agents.runReview).toHaveBeenCalledTimes(1); // no se re-revisó
    await expect(h.service.retryComment(pr.id)).rejects.toThrow(
      /already posted/,
    );
  });

  it('marks the pull request failed, records it and keeps going', async () => {
    const h = build();
    h.agents.runReview.mockRejectedValueOnce(new Error('claude exploded'));
    const first = await addPending(h, '1');
    const second = await addPending(h, '2');

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(first.status).toBe('failed');
    expect(first.lastError).toContain('claude exploded');
    expect(second.status).toBe('reviewed');
    expect(h.reviews.items.map((r) => r.status)).toEqual(['failed', 'ok']);
    expect(h.disposed.sort()).toEqual(['1', '2']); // limpió ambos checkouts
  });

  it('marks interrupted reviews as failed on startup and resumes the queue', async () => {
    const h = build();
    const interrupted = await addPending(h, '1');
    interrupted.markReviewing(); // quedó "en curso" por un corte
    const waiting = await addPending(h, '2');

    const count = await h.service.recoverInterrupted();
    await waitFor(() => allDone(h));

    expect(count).toBe(1);
    expect(interrupted.status).toBe('failed');
    expect(interrupted.lastError).toContain('restart');
    expect(waiting.status).toBe('reviewed');
  });
});

describe('ReviewsService tickets', () => {
  const planeTicket = (key: string, title: string) => ({
    key,
    title,
    stateName: 'En revisión',
    labels: ['backend'],
    priority: 'high',
    descriptionText: `Debe cubrir ${key}`,
  });

  it('gives the agent the tickets of the branch and the description, and records them', async () => {
    const h = build({
      tickets: {
        getTicket: jest.fn((key: string) =>
          Promise.resolve(planeTicket(key, `Título de ${key}`)),
        ),
      },
    });
    const pr = await addPending(h, '1', {
      sourceBranch: 'feature/MEL-253/entidad',
      description: 'Tickets: SER-10 y mel-253',
    });

    h.service.kick();
    await waitFor(() => allDone(h));

    const prompt = h.prompts[0];
    expect(prompt).toContain('### MEL-253 — Título de MEL-253');
    expect(prompt).toContain('### SER-10 — Título de SER-10');
    expect(prompt).toContain(
      'Estado: En revisión · Etiquetas: backend · Prioridad: high',
    );
    expect(prompt).toContain('Tickets: SER-10 y mel-253');
    expect(h.reviews.items[0].tickets).toEqual([
      {
        key: 'MEL-253',
        title: 'Título de MEL-253',
        state: 'En revisión',
        found: true,
        url: 'https://plane.test/ws/browse/MEL-253/',
      },
      expect.objectContaining({ key: 'SER-10', found: true }),
    ]);
    expect(pr.status).toBe('reviewed');
  });

  it('reviews a pull request without tickets and tells the agent so', async () => {
    const h = build();
    const pr = await addPending(h, '1', { sourceBranch: 'fix/log-email' });

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(h.prompts[0]).toContain('Sin ticket asociado');
    expect(h.reviews.items[0].tickets).toEqual([]);
    expect(h.tickets.getTicket.mock.calls).toHaveLength(0);
    expect(pr.status).toBe('reviewed');
  });

  it('does not block the review when a ticket cannot be read', async () => {
    const h = build({
      tickets: {
        getTicket: jest.fn((key: string) =>
          key === 'MEL-1'
            ? Promise.reject(new Error('Plane down'))
            : Promise.resolve(planeTicket(key, 'Ticket que sí se leyó')),
        ),
      },
    });
    const pr = await addPending(h, '1', {
      sourceBranch: 'feature/MEL-1/x',
      description: 'SER-2',
    });

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(pr.status).toBe('reviewed');
    expect(h.prompts[0]).toContain('No se pudo leer el ticket');
    expect(h.prompts[0]).toContain('### SER-2 — Ticket que sí se leyó');
    expect(h.reviews.items[0].tickets.map((t) => [t.key, t.found])).toEqual([
      ['MEL-1', false],
      ['SER-2', true],
    ]);
  });

  it('does not block the review when the list of Plane projects fails', async () => {
    const h = build({
      tickets: {
        getProjectIdentifiers: jest
          .fn()
          .mockRejectedValue(new Error('Plane down')),
      },
    });
    const pr = await addPending(h, '1', { sourceBranch: 'feature/MEL-5/x' });

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(pr.status).toBe('reviewed');
    expect(h.prompts[0]).toContain('Sin ticket asociado');
  });

  it('falls back to the tickets saved by the last sync when the project list fails', async () => {
    const h = build({
      tickets: {
        getProjectIdentifiers: jest
          .fn()
          .mockRejectedValue(new Error('Plane down')),
        getTicket: jest.fn((key: string) =>
          Promise.resolve(planeTicket(key, 'Ticket guardado')),
        ),
      },
    });
    const pr = await addPending(h, '1');
    pr.setTicketKeys(['MEL-77']);

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(h.prompts[0]).toContain('### MEL-77 — Ticket guardado');
  });

  it('does not wait forever for a ticket that never answers', async () => {
    const h = build({
      tickets: { getTicket: jest.fn(() => new Promise(() => undefined)) },
    });
    const pr = await addPending(h, '1', { sourceBranch: 'feature/MEL-9/x' });
    jest.useFakeTimers();
    try {
      h.service.kick();
      await jest.advanceTimersByTimeAsync(11_000);
      await jest.advanceTimersByTimeAsync(100);

      expect(h.prompts[0]).toContain('No se pudo leer el ticket');
      expect(pr.status).toBe('reviewed');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ReviewsService comment', () => {
  const postedBody = (h: Harness, call = 0): string => {
    const args = h.commentPort.postComment.mock.calls[call] as [
      string,
      string,
      string,
    ];
    return args[2];
  };

  it('says up to which commit the pull request was reviewed', async () => {
    const h = build();
    await addPending(h, '1');

    h.service.kick();
    await waitFor(() => allDone(h));

    const body = postedBody(h);
    expect(body).toContain('**Último commit revisado:** `head-1`');
    expect(body).toContain('## Resumen');
  });

  it('shows only the first 8 characters of a full commit hash', async () => {
    const full = 'abcdef0123456789abcdef0123456789abcdef01';
    const h = build({ checkoutCommit: full });
    await addPending(h, '2');

    h.service.kick();
    await waitFor(() => allDone(h));

    const body = postedBody(h);
    expect(body).toContain('**Último commit revisado:** `abcdef01`');
    expect(body).not.toContain(full);
  });

  it('keeps the commit when the comment is retried', async () => {
    const h = build();
    h.commentPort.postComment.mockRejectedValueOnce(new Error('403'));
    const pr = await addPending(h, '3');

    h.service.kick();
    await waitFor(() => allDone(h));
    await h.service.retryComment(pr.id);

    expect(postedBody(h, 1)).toContain('**Último commit revisado:** `head-3`');
  });
});

describe('ReviewsService refreshes the pull request before reviewing', () => {
  const fresh = (overrides = {}) => ({
    ...remotePullRequest('1'),
    ...overrides,
  });

  it('reviews with the current description, not the one saved by the last sync', async () => {
    const h = build({
      tickets: {
        getTicket: jest.fn((key: string) =>
          Promise.resolve({
            key,
            title: `Título de ${key}`,
            stateName: 'En revisión',
            labels: [],
            priority: null,
            descriptionText: 'Pide algo',
          }),
        ),
      },
      provider: {
        getPullRequest: jest
          .fn()
          .mockResolvedValue(
            fresh({ description: 'Tickets\n\n* **MEL-301**\n* MEL-303' }),
          ),
      },
    });
    // En la base la descripción todavía está vacía (la editaron después del último sync).
    const pr = await addPending(h, '1', { description: null });

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(h.prompts[0]).toContain('### MEL-301 — Título de MEL-301');
    expect(h.prompts[0]).toContain('### MEL-303 — Título de MEL-303');
    expect(pr.description).toContain('MEL-301');
    expect(pr.ticketKeys).toEqual(['MEL-301', 'MEL-303']);
    expect(h.reviews.items[0].tickets.map((t) => t.key)).toEqual([
      'MEL-301',
      'MEL-303',
    ]);
  });

  it('uses the current title in the prompt too', async () => {
    const h = build({
      provider: {
        getPullRequest: jest
          .fn()
          .mockResolvedValue(fresh({ title: 'Título editado' })),
      },
    });
    await addPending(h, '1');

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(h.prompts[0]).toContain('Título editado');
  });

  it('reviews with the saved data when the provider does not answer', async () => {
    const h = build({
      provider: {
        getPullRequest: jest
          .fn()
          .mockRejectedValue(new Error('Bitbucket down')),
      },
    });
    const pr = await addPending(h, '1', { description: 'Guardada' });

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(pr.status).toBe('reviewed');
    expect(h.prompts[0]).toContain('Guardada');
  });

  it('reviews with the saved data when the provider no longer knows the pull request', async () => {
    const h = build({
      provider: { getPullRequest: jest.fn().mockResolvedValue(null) },
    });
    const pr = await addPending(h, '1', { description: 'Guardada' });

    h.service.kick();
    await waitFor(() => allDone(h));

    expect(pr.status).toBe('reviewed');
    expect(h.prompts[0]).toContain('Guardada');
  });
});
