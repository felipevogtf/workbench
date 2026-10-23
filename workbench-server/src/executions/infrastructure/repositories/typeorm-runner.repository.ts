import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Runner } from '@executions/domain/entities/runner.entity';
import { RunnerRepositoryPort } from '@executions/domain/ports/runner-repository.port';
import { RunnerOrmEntity } from '@executions/infrastructure/persistence/runner.orm-entity';

@Injectable()
export class TypeOrmRunnerRepository implements RunnerRepositoryPort {
  constructor(
    @InjectRepository(RunnerOrmEntity)
    private readonly repository: Repository<RunnerOrmEntity>,
  ) {}

  async findById(id: string): Promise<Runner | null> {
    const orm = await this.repository.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<Runner | null> {
    const orm = await this.repository.findOne({
      where: { token_hash: tokenHash },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findAll(): Promise<Runner[]> {
    const rows = await this.repository.find({ order: { created_at: 'ASC' } });
    return rows.map((row) => this.toDomain(row));
  }

  async save(runner: Runner): Promise<Runner> {
    const props = runner.toProps();
    const saved = await this.repository.save({
      id: props.id,
      name: props.name,
      token_hash: props.tokenHash,
      version: props.version,
      host: props.host,
      last_seen_at: props.lastSeenAt,
      is_default: props.isDefault,
      created_at: props.createdAt,
    });
    return this.toDomain(saved);
  }

  async markSeen(
    id: string,
    info: { version?: string; host?: string } = {},
  ): Promise<boolean> {
    const result = await this.repository.update(id, {
      last_seen_at: new Date(),
      ...(info.version !== undefined && { version: info.version.slice(0, 40) }),
      ...(info.host !== undefined && { host: info.host.slice(0, 120) }),
    });
    return (result.affected ?? 0) > 0;
  }

  async makeDefault(id: string): Promise<void> {
    await this.repository.query('UPDATE runners SET is_default = (id = $1)', [
      id,
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(orm: RunnerOrmEntity): Runner {
    return Runner.reconstruct({
      id: orm.id,
      name: orm.name,
      tokenHash: orm.token_hash,
      version: orm.version,
      host: orm.host,
      lastSeenAt: orm.last_seen_at,
      isDefault: orm.is_default,
      createdAt: orm.created_at,
    });
  }
}
