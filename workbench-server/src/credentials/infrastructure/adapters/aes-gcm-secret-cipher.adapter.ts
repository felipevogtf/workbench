import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretCipherPort } from '@credentials/domain/ports/secret-cipher.port';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * AES-256-GCM con la clave de `ENCRYPTION_KEY` (32 bytes en hex).
 * Formato: base64(iv[12] + tag[16] + texto cifrado), con un IV nuevo en cada cifrado.
 */
@Injectable()
export class AesGcmSecretCipherAdapter implements SecretCipherPort {
  constructor(private readonly config: ConfigService) {}

  encrypt(plain: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64',
    );
  }

  decrypt(encrypted: string): string {
    const buffer = Buffer.from(encrypted, 'base64');
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const text = buffer.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(text), decipher.final()]).toString(
      'utf8',
    );
  }

  private get key(): Buffer {
    return Buffer.from(this.config.getOrThrow<string>('ENCRYPTION_KEY'), 'hex');
  }
}
