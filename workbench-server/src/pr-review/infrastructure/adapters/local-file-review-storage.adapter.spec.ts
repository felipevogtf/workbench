import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { LocalFileReviewStorageAdapter } from './local-file-review-storage.adapter';

describe('LocalFileReviewStorageAdapter', () => {
  let dir: string;
  let storage: LocalFileReviewStorageAdapter;

  const pr = PullRequest.createFromRemote({
    provider: 'github',
    repo: 'acme/web',
    externalId: '7',
    url: 'https://example.test/7',
    title: 't',
    author: 'a',
    sourceBranch: 's',
    destBranch: 'd',
    headCommit: 'abcdef123456',
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'reviews-test-'));
    storage = new LocalFileReviewStorageAdapter({
      getOrThrow: () => dir,
    } as unknown as ConfigService);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('saves under provider/owner/repo and reads it back', async () => {
    const docPath = await storage.save(pr, 'abcdef123456', '# Hola');

    expect(docPath).toMatch(/^github\/acme\/web\/7-abcdef12-\d+\.md$/);
    await expect(storage.read(docPath)).resolves.toBe('# Hola');
  });

  it('does not overwrite a previous review of the same commit', async () => {
    const first = await storage.save(pr, 'abcdef123456', 'uno');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await storage.save(pr, 'abcdef123456', 'dos');

    expect(second).not.toBe(first);
    await expect(storage.read(first)).resolves.toBe('uno');
  });

  it('refuses to read outside the reviews directory', async () => {
    await expect(storage.read('../../etc/passwd')).rejects.toThrow(
      /Invalid review path/,
    );
  });
});
