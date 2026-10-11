import { DomainError } from '@core/domain/domain.error';
import { CredentialItem } from './credential-item.entity';
import { CredentialGroupProps } from './credential-group.props';

export class CredentialGroup {
  private constructor(private props: CredentialGroupProps) {
    this.validateName(props.name);
  }

  static create(data: {
    name: string;
    category?: string | null;
    items?: { key: string; value: string; sensitive?: boolean }[];
  }): CredentialGroup {
    const now = new Date();
    return new CredentialGroup({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      category: CredentialGroup.normalizeCategory(data.category),
      items: (data.items ?? []).map((item) => CredentialItem.create(item)),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: CredentialGroupProps): CredentialGroup {
    return new CredentialGroup(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get category(): string | null {
    return this.props.category;
  }

  /** Los ítems en su orden de presentación. */
  get items(): readonly CredentialItem[] {
    return [...this.props.items];
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(name: string): void {
    this.validateName(name);
    this.props.name = name.trim();
    this.touch();
  }

  changeCategory(category: string | null): void {
    this.props.category = CredentialGroup.normalizeCategory(category);
    this.touch();
  }

  addItem(data: {
    key: string;
    value: string;
    sensitive?: boolean;
  }): CredentialItem {
    const item = CredentialItem.create(data);
    this.props.items.push(item);
    this.touch();
    return item;
  }

  updateItem(
    itemId: string,
    data: { key?: string; value?: string; sensitive?: boolean },
  ): CredentialItem {
    const item = this.getItem(itemId);
    item.update(data);
    this.touch();
    return item;
  }

  removeItem(itemId: string): void {
    const item = this.getItem(itemId);
    this.props.items = this.props.items.filter((current) => current !== item);
    this.touch();
  }

  getItem(itemId: string): CredentialItem {
    const item = this.props.items.find((current) => current.id === itemId);
    if (!item) {
      throw DomainError.notFound(`Item with id ${itemId} not found`);
    }
    return item;
  }

  private validateName(name: string): void {
    if (!name || name.trim() === '') {
      throw new DomainError('Name is required');
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static normalizeCategory(
    category: string | null | undefined,
  ): string | null {
    const trimmed = category?.trim();
    return trimmed ? trimmed : null;
  }
}
