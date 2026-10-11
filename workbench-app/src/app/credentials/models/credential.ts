export interface CredentialItem {
  id: string;
  key: string;
  sensitive: boolean;
  /** `null` si el ítem es sensible: el servidor solo lo entrega al revelarlo. */
  value: string | null;
}

export interface CredentialGroup {
  id: string;
  name: string;
  category: string | null;
  items: CredentialItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemInput {
  key: string;
  value: string;
  sensitive?: boolean;
}

export interface GroupInput {
  name: string;
  category?: string | null;
  /** Solo al crear: los campos con los que nace el grupo. */
  items?: ItemInput[];
}
