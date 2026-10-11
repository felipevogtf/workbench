import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@core/domain/domain.error';
import { CredentialGroup } from '@credentials/domain/entities/credential-group.entity';
import {
  CREDENTIAL_GROUP_REPOSITORY_PORT,
  type CredentialGroupRepositoryPort,
} from '@credentials/domain/ports/credential-group-repository.port';

interface ItemData {
  key: string;
  value: string;
  sensitive?: boolean;
}

interface CreateGroupData {
  name: string;
  category?: string | null;
  items?: ItemData[];
}

@Injectable()
export class CredentialsService {
  constructor(
    @Inject(CREDENTIAL_GROUP_REPOSITORY_PORT)
    private readonly groups: CredentialGroupRepositoryPort,
  ) {}

  listGroups(): Promise<CredentialGroup[]> {
    return this.groups.findAll();
  }

  async createGroup(data: CreateGroupData): Promise<CredentialGroup> {
    const group = CredentialGroup.create(data);
    await this.groups.save(group);
    return group;
  }

  async updateGroup(
    id: string,
    data: { name?: string; category?: string | null },
  ): Promise<CredentialGroup> {
    const group = await this.getGroup(id);

    if (data.name !== undefined) group.rename(data.name);
    if (data.category !== undefined) group.changeCategory(data.category);

    await this.groups.save(group);
    return group;
  }

  async deleteGroup(id: string): Promise<void> {
    await this.getGroup(id);
    await this.groups.delete(id);
  }

  async addItem(groupId: string, data: ItemData): Promise<CredentialGroup> {
    const group = await this.getGroup(groupId);
    group.addItem(data);
    await this.groups.save(group);
    return group;
  }

  async updateItem(
    groupId: string,
    itemId: string,
    data: Partial<ItemData>,
  ): Promise<CredentialGroup> {
    const group = await this.getGroup(groupId);
    group.updateItem(itemId, data);
    await this.groups.save(group);
    return group;
  }

  async removeItem(groupId: string, itemId: string): Promise<CredentialGroup> {
    const group = await this.getGroup(groupId);
    group.removeItem(itemId);
    await this.groups.save(group);
    return group;
  }

  /** El valor en claro de un ítem: la única vía para leer uno sensible. */
  async revealItem(groupId: string, itemId: string): Promise<string> {
    const group = await this.getGroup(groupId);
    return group.getItem(itemId).value;
  }

  private async getGroup(id: string): Promise<CredentialGroup> {
    const group = await this.groups.findById(id);
    if (!group) {
      throw DomainError.notFound(`Credential group with id ${id} not found`);
    }
    return group;
  }
}
