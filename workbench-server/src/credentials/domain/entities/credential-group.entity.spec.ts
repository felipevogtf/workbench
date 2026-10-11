import { DomainError } from '@core/domain/domain.error';
import { CredentialGroup } from './credential-group.entity';

const aws = () =>
  CredentialGroup.create({
    name: 'aws',
    items: [
      { key: 'usuario', value: 'felipe' },
      { key: 'pass', value: 's3cret', sensitive: true },
    ],
  });

describe('CredentialGroup', () => {
  it('keeps the items in order and sensitive is off by default', () => {
    const group = aws();

    expect(group.items.map((item) => item.key)).toEqual(['usuario', 'pass']);
    expect(group.items.map((item) => item.sensitive)).toEqual([false, true]);
  });

  it('trims the name and turns a blank category into null', () => {
    const group = CredentialGroup.create({ name: '  aws ', category: '  ' });

    expect(group.name).toBe('aws');
    expect(group.category).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(() => CredentialGroup.create({ name: '  ' })).toThrow(DomainError);
    expect(() => aws().rename('')).toThrow(DomainError);
  });

  it.each([
    ['key', { key: ' ', value: 'x' }],
    ['value', { key: 'k', value: '' }],
  ])('rejects an item without %s', (_field, item) => {
    expect(() => aws().addItem(item)).toThrow(DomainError);
    expect(() => CredentialGroup.create({ name: 'g', items: [item] })).toThrow(
      DomainError,
    );
  });

  it('adds, updates and removes an item', () => {
    const group = aws();

    const added = group.addItem({ key: 'region', value: 'us-east-1' });
    expect(group.items).toHaveLength(3);

    group.updateItem(added.id, { value: 'sa-east-1' });
    expect(group.getItem(added.id).value).toBe('sa-east-1');

    group.removeItem(added.id);
    expect(group.items).toHaveLength(2);
  });

  it('keeps the current value when an update does not send one', () => {
    const group = aws();
    const pass = group.items[1];

    group.updateItem(pass.id, { sensitive: false });

    expect(pass.sensitive).toBe(false);
    expect(pass.value).toBe('s3cret');
  });

  it('leaves the item untouched when an update is invalid', () => {
    const group = aws();
    const user = group.items[0];

    expect(() => group.updateItem(user.id, { key: 'ok', value: '' })).toThrow(
      DomainError,
    );
    expect(user.key).toBe('usuario');
    expect(user.value).toBe('felipe');
  });

  it('fails with not-found for an unknown item', () => {
    const group = aws();

    expect(() => group.getItem('nope')).toThrow(/not found/);
    expect(() => group.removeItem('nope')).toThrow(DomainError);
  });
});
