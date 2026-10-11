import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { CredentialGroup } from '@credentials/domain/entities/credential-group.entity';
import { CredentialItem } from '@credentials/domain/entities/credential-item.entity';
import { CredentialGroupRepositoryPort } from '@credentials/domain/ports/credential-group-repository.port';
import {
  SECRET_CIPHER_PORT,
  type SecretCipherPort,
} from '@credentials/domain/ports/secret-cipher.port';
import { CredentialGroupOrmEntity } from '@credentials/infrastructure/persistence/credential-group.orm-entity';
import { CredentialItemOrmEntity } from '@credentials/infrastructure/persistence/credential-item.orm-entity';

/** Persiste los grupos con sus ítems; los valores se guardan cifrados. */
@Injectable()
export class TypeOrmCredentialGroupRepository implements CredentialGroupRepositoryPort {
  constructor(
    @InjectRepository(CredentialGroupOrmEntity)
    private readonly groupRepository: Repository<CredentialGroupOrmEntity>,
    @InjectRepository(CredentialItemOrmEntity)
    private readonly itemRepository: Repository<CredentialItemOrmEntity>,
    @Inject(SECRET_CIPHER_PORT) private readonly cipher: SecretCipherPort,
  ) {}

  async findById(groupId: string): Promise<CredentialGroup | null> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });
    if (!group) return null;

    const items = await this.itemRepository.find({
      where: { group_id: groupId },
      order: { position: 'ASC' },
    });
    return this.toDomain(group, items);
  }

  async findAll(): Promise<CredentialGroup[]> {
    const [groups, items] = await Promise.all([
      this.groupRepository.find({ order: { created_at: 'ASC' } }),
      this.itemRepository.find({ order: { position: 'ASC' } }),
    ]);

    const byGroup = new Map<string, CredentialItemOrmEntity[]>();
    for (const item of items) {
      const list = byGroup.get(item.group_id) ?? [];
      list.push(item);
      byGroup.set(item.group_id, list);
    }

    return groups.map((group) =>
      this.toDomain(group, byGroup.get(group.id) ?? []),
    );
  }

  async save(group: CredentialGroup): Promise<void> {
    await this.groupRepository.manager.transaction(async (manager) => {
      await manager.save(CredentialGroupOrmEntity, {
        id: group.id,
        name: group.name,
        category: group.category,
      });

      // Los ítems que ya no están en el grupo se borran; los demás se actualizan por su id.
      const ids = group.items.map((item) => item.id);
      await manager.delete(CredentialItemOrmEntity, {
        group_id: group.id,
        ...(ids.length > 0 && { id: Not(In(ids)) }),
      });

      if (group.items.length > 0) {
        await manager.save(
          CredentialItemOrmEntity,
          group.items.map((item, position) => ({
            id: item.id,
            group_id: group.id,
            key: item.key,
            value_enc: this.cipher.encrypt(item.value),
            sensitive: item.sensitive,
            position,
          })),
        );
      }
    });
  }

  async delete(groupId: string): Promise<void> {
    await this.groupRepository.manager.transaction(async (manager) => {
      await manager.delete(CredentialItemOrmEntity, { group_id: groupId });
      await manager.delete(CredentialGroupOrmEntity, { id: groupId });
    });
  }

  private toDomain(
    group: CredentialGroupOrmEntity,
    items: CredentialItemOrmEntity[],
  ): CredentialGroup {
    return CredentialGroup.reconstruct({
      id: group.id,
      name: group.name,
      category: group.category,
      items: items.map((item) =>
        CredentialItem.reconstruct({
          id: item.id,
          key: item.key,
          value: this.cipher.decrypt(item.value_enc),
          sensitive: item.sensitive,
        }),
      ),
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    });
  }
}
