/** Cifrado reversible de los valores guardados. */
export interface SecretCipherPort {
  encrypt(plain: string): string;
  /** Rechaza si el texto fue alterado o se cifró con otra clave. */
  decrypt(encrypted: string): string;
}

export const SECRET_CIPHER_PORT = Symbol('SecretCipherPort');
