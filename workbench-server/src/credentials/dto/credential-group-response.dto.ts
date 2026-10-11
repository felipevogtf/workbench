export class CredentialItemResponseDto {
  id!: string;
  key!: string;
  sensitive!: boolean;
  /** `null` si el ítem es sensible: se obtiene con el endpoint de revelar. */
  value!: string | null;
}

export class CredentialGroupResponseDto {
  id!: string;
  name!: string;
  category!: string | null;
  items!: CredentialItemResponseDto[];
  createdAt!: string;
  updatedAt!: string;
}

export class RevealedValueResponseDto {
  value!: string;
}
