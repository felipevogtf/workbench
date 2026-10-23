import { RUNNER_ONLINE_MS } from '@executions/domain/entities/runner.entity';
import { hashToken, RunnersService } from './runners.service';
import { InMemoryRunners } from './testing/fakes';

describe('RunnersService', () => {
  let repository: InMemoryRunners;
  let service: RunnersService;

  beforeEach(() => {
    repository = new InMemoryRunners();
    service = new RunnersService(repository);
  });

  it('shows the token once and keeps only its hash', async () => {
    const { runner, token } = await service.create('Mi PC');

    expect(token).toMatch(/^wbr_/);
    expect(runner.tokenHash).toBe(hashToken(token));
    expect(runner.tokenHash).not.toContain(token);
  });

  it('needs a name', async () => {
    await expect(service.create('   ')).rejects.toThrow('name');
  });

  it('authenticates with the token and with nothing else', async () => {
    const { runner, token } = await service.create('Mi PC');

    expect((await service.authenticate(token))?.id).toBe(runner.id);
    expect(await service.authenticate('wbr_otro')).toBeNull();
    expect(await service.authenticate(runner.tokenHash)).toBeNull();
    expect(await service.authenticate('')).toBeNull();
  });

  it('stops authenticating a deleted runner', async () => {
    const { runner, token } = await service.create('Mi PC');
    await service.delete(runner.id);

    expect(await service.authenticate(token)).toBeNull();
    await expect(service.delete(runner.id)).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('is online only while it keeps giving signs of life', async () => {
    const { runner } = await service.create('Mi PC');
    expect(runner.isOnline()).toBe(false);
    expect(await service.anyOnline()).toBe(false);

    await service.touch(runner);
    expect(runner.isOnline()).toBe(true);
    expect(await service.anyOnline()).toBe(true);
    expect(runner.isOnline(new Date(Date.now() + RUNNER_ONLINE_MS + 1))).toBe(
      false,
    );
  });

  it('remembers who the runner says it is', async () => {
    const { runner } = await service.create('Mi PC');
    await service.introduce(runner, { version: '0.1.0', host: 'DESKTOP-1' });

    expect(runner).toMatchObject({ version: '0.1.0', host: 'DESKTOP-1' });
  });
});
