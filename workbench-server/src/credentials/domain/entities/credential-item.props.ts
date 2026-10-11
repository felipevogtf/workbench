export interface CredentialItemProps {
  id: string;
  key: string;
  /** Valor en claro: el cifrado es un detalle de la persistencia. */
  value: string;
  /** Un valor sensible no se envía al listar; solo se obtiene al revelarlo. */
  sensitive: boolean;
}
