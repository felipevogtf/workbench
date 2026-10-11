import { CredentialGroup } from '@credentials/domain/entities/credential-group.entity';
import { CredentialGroupRepositoryPort } from '@credentials/domain/ports/credential-group-repository.port';
import { CredentialsService } from './credentials.service';

function build() {
  const stored = new Map<string, CredentialGroup>();
  const repo: CredentialGroupRepositoryPort = {
    findById: (id) => Promise.resolve(stored.get(id) ?? null),
    findAll: () => Promise.resolve([...stored.values()]),
    save: (group) => {
      stored.set(group.id, group);
      return Promise.resolve();
    },
    delete: (id) => {
      stored.delete(id);
      return Promise.resolve();
    },
  };
  return { service: new CredentialsService(repo), stored };
}

describe('CredentialsService', () => {
  it('creates a group with its items', async () => {
    const { service, stored } = build();

    const group = await service.createGroup({
      name: 'aws',
      category: 'cloud',
      items: [{ key: 'usuario', value: 'felipe' }],
    });

    expect(stored.get(group.id)?.items).toHaveLength(1);
    expect(group.category).toBe('cloud');
  });

  it('updates the name and clears the category', async () => {
    const { service } = build();
    const { id } = await service.createGroup({ name: 'aws', category: 'x' });

    const updated = await service.updateGroup(id, {
      name: 'aws prod',
      category: null,
    });

    expect(updated.name).toBe('aws prod');
    expect(updated.category).toBeNull();
  });

  it('manages the items of a group', async () => {
    const { service } = build();
    const { id } = await service.createGroup({ name: 'aws' });

    const withItem = await service.addItem(id, { key: 'pass', value: 'a' });
    const itemId = withItem.items[0].id;
    await service.updateItem(id, itemId, { value: 'b' });
    expect(await service.revealItem(id, itemId)).toBe('b');

    const emptied = await service.removeItem(id, itemId);
    expect(emptied.items).toHaveLength(0);
  });

  it('fails with not-found for a missing group', async () => {
    const { service } = build();

    await expect(service.deleteGroup('nope')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(
      service.addItem('nope', { key: 'k', value: 'v' }),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(service.revealItem('nope', 'x')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('deletes a group', async () => {
    const { service, stored } = build();
    const { id } = await service.createGroup({ name: 'aws' });

    await service.deleteGroup(id);

    expect(stored.size).toBe(0);
  });
});
