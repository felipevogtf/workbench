import { PullRequestPublisherService } from './pull-request-publisher.service';
import type {
  NewPullRequestData,
  PullRequestCreationPort,
} from '@pr-review/domain/ports/pull-request-creation.port';

const data: NewPullRequestData = {
  repo: 'acme/web',
  sourceBranch: 'workbench/x',
  destBranch: 'main',
  title: 'Título',
  description: 'Descripción',
  reviewerIds: [],
};

describe('PullRequestPublisherService', () => {
  it('opens the pull request with the creator of the provider', async () => {
    const create = jest.fn<Promise<{ url: string }>, [NewPullRequestData]>(() =>
      Promise.resolve({ url: 'https://bitbucket.org/acme/web/pull/1' }),
    );
    const bitbucket: PullRequestCreationPort = {
      provider: 'bitbucket',
      create,
    };
    const service = new PullRequestPublisherService([bitbucket]);

    await expect(service.create('bitbucket', data)).resolves.toEqual({
      url: 'https://bitbucket.org/acme/web/pull/1',
    });
    expect(create).toHaveBeenCalledWith(data);
  });

  it('says so when the provider cannot open pull requests', async () => {
    const service = new PullRequestPublisherService([]);

    await expect(service.create('github', data)).rejects.toThrow(
      'not supported or not configured',
    );
  });
});
