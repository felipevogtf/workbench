import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { Runner } from '@executions/domain/entities/runner.entity';
import {
  RUNNER_REPOSITORY_PORT,
  type RunnerRepositoryPort,
} from '@executions/domain/ports/runner-repository.port';

const TOKEN_PREFIX = 'wbr_';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Alta, baja y autenticación de los runners (los programas que ejecutan el trabajo en un PC). */
@Injectable()
export class RunnersService {
  constructor(
    @Inject(RUNNER_REPOSITORY_PORT)
    private readonly runners: RunnerRepositoryPort,
  ) {}

  findAll(): Promise<Runner[]> {
    return this.runners.findAll();
  }

  /** El token solo se devuelve aquí: después solo queda su huella. */
  async create(name: string): Promise<{ runner: Runner; token: string }> {
    if (!name.trim()) throw new DomainError('The runner needs a name');

    const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
    // El primero que se crea es el predeterminado; los demás, solo si se elige después.
    const first = (await this.runners.findAll()).length === 0;
    const runner = await this.runners.save(
      Runner.create({ name, tokenHash: hashToken(token), isDefault: first }),
    );
    return { runner, token };
  }

  /** Revoca el runner. Si era el predeterminado, el más antiguo que quede lo reemplaza. */
  async delete(id: string): Promise<void> {
    const runner = await this.runners.findById(id);
    if (!runner) {
      throw DomainError.notFound(`Runner with id ${id} not found`);
    }
    await this.runners.delete(id);

    if (runner.isDefault) {
      const [next] = await this.runners.findAll();
      if (next) await this.runners.makeDefault(next.id);
    }
  }

  /** Elige el runner predeterminado; el anterior deja de serlo. */
  async setDefault(id: string): Promise<Runner[]> {
    if (!(await this.runners.findById(id))) {
      throw DomainError.notFound(`Runner with id ${id} not found`);
    }
    await this.runners.makeDefault(id);
    return this.runners.findAll();
  }

  /** El runner dueño del token, o `null` si no existe o fue revocado. */
  authenticate(token: string): Promise<Runner | null> {
    if (!token.startsWith(TOKEN_PREFIX)) return Promise.resolve(null);
    return this.runners.findByTokenHash(hashToken(token));
  }

  /** El runner se presenta. `false` si ya lo revocaron mientras tanto. */
  async introduce(
    runner: Runner,
    info: { version?: string; host?: string },
  ): Promise<boolean> {
    runner.introduce(info);
    return this.runners.markSeen(runner.id, info);
  }

  /** Marca que el runner sigue vivo. `false` si ya lo revocaron (no se vuelve a crear). */
  async touch(runner: Runner): Promise<boolean> {
    runner.introduce({});
    return this.runners.markSeen(runner.id);
  }

  /** `true` si algún runner dio señales hace poco. */
  async anyOnline(): Promise<boolean> {
    return (await this.runners.findAll()).some((runner) => runner.isOnline());
  }
}
