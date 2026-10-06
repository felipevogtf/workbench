import { DomainError } from '@core/domain/domain.error';
import { PullRequest } from './pull-request.entity';

const remote = {
  provider: 'bitbucket' as const,
  repo: 'ws/app',
  externalId: '12',
  url: 'https://example.test/pr/12',
  title: 'Add feature',
  author: 'Ana',
  sourceBranch: 'feature/x',
  destBranch: 'main',
  headCommit: 'aaaaaaaa1111',
  description: null,
};

describe('PullRequest', () => {
  it('is born pending and open', () => {
    const pr = PullRequest.createFromRemote(remote);

    expect(pr.status).toBe('pending');
    expect(pr.state).toBe('open');
    expect(pr.isStale).toBe(false);
  });

  it('only a pending pull request can start reviewing', () => {
    const pr = PullRequest.createFromRemote(remote);

    pr.markReviewing();

    expect(pr.status).toBe('reviewing');
    expect(() => pr.markReviewing()).toThrow(DomainError);
  });

  it('becomes stale when a new commit arrives after being reviewed', () => {
    const pr = PullRequest.createFromRemote(remote);
    pr.markReviewing();
    pr.markReviewed({ commit: 'aaaaaaaa1111', docPath: 'a.md' });

    pr.syncFromRemote({ ...remote, headCommit: 'bbbbbbbb2222' });

    expect(pr.isStale).toBe(true);
    // El sync no la vuelve a encolar: la re-revisión es manual.
    expect(pr.status).toBe('reviewed');
  });

  it('does not flag as stale a short head commit that is the reviewed commit', () => {
    // Bitbucket entrega 12 caracteres; el checkout de git, 40.
    const full = 'abc12345def6' + '7890abcdef1234567890abcdef12';
    const pr = PullRequest.createFromRemote({ ...remote, headCommit: full });
    pr.markReviewing();
    pr.markReviewed({ commit: full, docPath: 'a.md' });

    pr.syncFromRemote({ ...remote, headCommit: full.slice(0, 12) });

    expect(pr.isStale).toBe(false);
  });

  it('flags as stale a different commit even when only one is abbreviated', () => {
    const full = 'abc12345def6' + '7890abcdef1234567890abcdef12';
    const pr = PullRequest.createFromRemote({ ...remote, headCommit: full });
    pr.markReviewing();
    pr.markReviewed({ commit: full, docPath: 'a.md' });

    pr.syncFromRemote({ ...remote, headCommit: 'ffffffffffff' });

    expect(pr.isStale).toBe(true);
  });

  it('records the reviewed commit and clears the requested override', () => {
    const pr = PullRequest.createFromRemote(remote);
    pr.enqueue({ agentId: 'agent-1', model: 'opus' });
    pr.markReviewing();

    pr.markReviewed({ commit: 'cccccccc3333', docPath: 'doc.md' });

    expect(pr.reviewedCommit).toBe('cccccccc3333');
    expect(pr.reviewDocUrl).toBe('doc.md');
    expect(pr.lastReviewedAt).not.toBeNull();
    expect(pr.requestedAgentId).toBeNull();
    expect(pr.requestedModel).toBeNull();
  });

  describe('enqueue (manual re-review)', () => {
    it('puts a reviewed pull request back in the queue with the override', () => {
      const pr = PullRequest.createFromRemote(remote);
      pr.markReviewing();
      pr.markReviewed({ commit: 'aaaaaaaa1111', docPath: 'a.md' });
      const before = pr.queuedAt;

      pr.enqueue({ agentId: 'agent-2', model: 'opus' });

      expect(pr.status).toBe('pending');
      expect(pr.requestedAgentId).toBe('agent-2');
      expect(pr.requestedModel).toBe('opus');
      expect(pr.queuedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('keeps its place in the queue when it is already pending', () => {
      const pr = PullRequest.createFromRemote(remote);
      const before = pr.queuedAt;

      pr.enqueue({ model: 'opus' });

      expect(pr.queuedAt).toBe(before);
      expect(pr.requestedModel).toBe('opus');
    });

    it('is a conflict while it is being reviewed', () => {
      const pr = PullRequest.createFromRemote(remote);
      pr.markReviewing();

      let error: unknown;
      try {
        pr.enqueue();
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).kind).toBe('conflict');
    });

    it('rejects closed pull requests', () => {
      const pr = PullRequest.createFromRemote(remote);
      pr.markClosed();

      expect(() => pr.enqueue()).toThrow(DomainError);
    });
  });

  it('reopens when the provider lists it again', () => {
    const pr = PullRequest.createFromRemote(remote);
    pr.markClosed();

    pr.syncFromRemote(remote);

    expect(pr.state).toBe('open');
  });
});
