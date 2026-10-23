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

  it('does not bring a revoked runner back when a request of it was still in flight', async () => {
    const { runner, token } = await service.create('Mi PC');
    await service.delete(runner.id);

    // El runner había sido autenticado antes de que lo revocaran y sigue dando señales.
    expect(await service.touch(runner)).toBe(false);
    expect(await service.introduce(runner, { version: '0.1.0' })).toBe(false);

    expect(await service.findAll()).toEqual([]);
    expect(await service.authenticate(token)).toBeNull();
  });

  describe('the default runner', () => {
    it('is the first one created; the next ones are not', async () => {
      const first = await service.create('Mi PC');
      const second = await service.create('Portátil');

      expect(first.runner.isDefault).toBe(true);
      expect(second.runner.isDefault).toBe(false);
    });

    it('can be changed, and there is only ever one', async () => {
      await service.create('Mi PC');
      const second = await service.create('Portátil');

      const runners = await service.setDefault(second.runner.id);

      expect(runners.filter((r) => r.isDefault).map((r) => r.name)).toEqual([
        'Portátil',
      ]);
    });

    it('cannot be set on a runner that does not exist', async () => {
      await expect(service.setDefault('nada')).rejects.toMatchObject({
        kind: 'not-found',
      });
    });

    it('passes to the oldest one left when it is revoked', async () => {
      const first = await service.create('Mi PC');
      await service.create('Portátil');
      await service.create('Servidor');

      await service.delete(first.runner.id);

      const left = await service.findAll();
      expect(left.map((r) => [r.name, r.isDefault])).toEqual([
        ['Portátil', true],
        ['Servidor', false],
      ]);
    });

    it('stays as it was when another runner is revoked', async () => {
      await service.create('Mi PC');
      const second = await service.create('Portátil');

      await service.delete(second.runner.id);

      expect((await service.findAll()).map((r) => r.isDefault)).toEqual([true]);
    });

    it('lets the next runner created be the default again when none is left', async () => {
      const first = await service.create('Mi PC');
      await service.delete(first.runner.id);

      const next = await service.create('Otro');

      expect(next.runner.isDefault).toBe(true);
    });
  });

  it('remembers who the runner says it is', async () => {
    const { runner } = await service.create('Mi PC');
    await service.introduce(runner, { version: '0.1.0', host: 'DESKTOP-1' });

    expect(runner).toMatchObject({ version: '0.1.0', host: 'DESKTOP-1' });
  });
});
