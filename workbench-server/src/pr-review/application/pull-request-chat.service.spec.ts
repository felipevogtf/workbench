import { DomainError } from '@core/domain/domain.error';
import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';
import { AgentsGatewayPort } from '@pr-review/domain/ports/agents-gateway.port';
import { PullRequestChatService } from './pull-request-chat.service';
import { PullRequestsService } from './pull-requests.service';
import { remotePullRequest, sleep } from './testing/fakes';

function build(concurrency = 2) {
  const pullRequest = PullRequest.createFromRemote(remotePullRequest('1'));
  const findById = jest.fn((id: string) =>
    id === pullRequest.id
      ? Promise.resolve(pullRequest)
      : Promise.reject(DomainError.notFound('missing')),
  );
  const ensure = jest
    .fn()
    .mockResolvedValue({ path: '/repos/pr-1', commit: 'abc123' });
  const runChat = jest.fn().mockResolvedValue({
    markdown: 'Esto hace X.',
    agentName: 'default-chat',
    model: 'claude-sonnet-5-5',
  });

  const service = new PullRequestChatService(
    { findById } as unknown as PullRequestsService,
    { ensure },
    { runChat } as unknown as AgentsGatewayPort,
    concurrency,
  );
  return { service, pullRequest, ensure, runChat };
}

describe('PullRequestChatService', () => {
  it('answers with the agent running inside the repository of the pull request', async () => {
    const { service, pullRequest, ensure, runChat } = build();

    const result = await service.reply(pullRequest.id, [
      { role: 'user', content: 'Qué hace esto?' },
    ]);

    expect(ensure).toHaveBeenCalledWith(pullRequest);
    expect(runChat).toHaveBeenCalledWith({
      prompt: expect.stringContaining('Qué hace esto?') as string,
      workdir: '/repos/pr-1',
    });
    expect(result).toEqual({
      reply: 'Esto hace X.',
      agentName: 'default-chat',
      model: 'claude-sonnet-5-5',
      commit: 'abc123',
    });
  });

  it('gives the agent the file the user has open', async () => {
    const { service, pullRequest, runChat } = build();

    await service.reply(
      pullRequest.id,
      [{ role: 'user', content: 'Qué hace esto?' }],
      { path: 'src/a.ts', status: 'added' },
    );

    expect(runChat).toHaveBeenCalledWith({
      prompt: expect.stringContaining(
        '`src/a.ts` (añadido en esta PR)',
      ) as string,
      workdir: '/repos/pr-1',
    });
  });

  it('rejects a chat that does not end with a message of the user', async () => {
    const { service, pullRequest, ensure } = build();

    await expect(service.reply(pullRequest.id, [])).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(
      service.reply(pullRequest.id, [
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'hola!' },
      ]),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      service.reply(pullRequest.id, [{ role: 'user', content: '   ' }]),
    ).rejects.toBeInstanceOf(DomainError);
    expect(ensure).not.toHaveBeenCalled();
  });

  it('fails when the pull request does not exist', async () => {
    const { service } = build();

    await expect(
      service.reply('nope', [{ role: 'user', content: 'hola' }]),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('answers only as many questions at a time as the limit allows', async () => {
    const { service, pullRequest, runChat } = build(1);
    let running = 0;
    let peak = 0;
    runChat.mockImplementation(async () => {
      peak = Math.max(peak, ++running);
      await sleep(5);
      running--;
      return { markdown: 'ok', agentName: 'a', model: 'm' };
    });

    await Promise.all(
      [1, 2, 3].map(() =>
        service.reply(pullRequest.id, [{ role: 'user', content: 'hola' }]),
      ),
    );

    expect(peak).toBe(1);
  });
});
