import { DomainError } from '@core/domain/domain.error';
import { CredentialItemProps } from './credential-item.props';

export class CredentialItem {
  private constructor(private props: CredentialItemProps) {
    this.validate(props.key, props.value);
  }

  static create(data: {
    key: string;
    value: string;
    sensitive?: boolean;
  }): CredentialItem {
    return new CredentialItem({
      id: crypto.randomUUID(),
      key: data.key.trim(),
      value: data.value,
      sensitive: data.sensitive ?? false,
    });
  }

  static reconstruct(props: CredentialItemProps): CredentialItem {
    return new CredentialItem(props);
  }

  get id(): string {
    return this.props.id;
  }

  get key(): string {
    return this.props.key;
  }

  get value(): string {
    return this.props.value;
  }

  get sensitive(): boolean {
    return this.props.sensitive;
  }

  /** Aplica solo lo indicado; si algo es inválido no cambia nada. */
  update(data: { key?: string; value?: string; sensitive?: boolean }): void {
    const key = data.key === undefined ? this.props.key : data.key.trim();
    const value = data.value ?? this.props.value;
    this.validate(key, value);

    this.props.key = key;
    this.props.value = value;
    if (data.sensitive !== undefined) this.props.sensitive = data.sensitive;
  }

  private validate(key: string, value: string): void {
    if (!key || key.trim() === '') {
      throw new DomainError('Item key is required');
    }
    if (!value) {
      throw new DomainError('Item value is required');
    }
  }
}
