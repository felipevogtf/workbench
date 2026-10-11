import { ConfigService } from '@nestjs/config';
import { AesGcmSecretCipherAdapter } from './aes-gcm-secret-cipher.adapter';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

const cipherWith = (key: string) =>
  new AesGcmSecretCipherAdapter({
    getOrThrow: () => key,
  } as unknown as ConfigService);

describe('AesGcmSecretCipherAdapter', () => {
  it('decrypts what it encrypted, including unicode', () => {
    const cipher = cipherWith(KEY);

    expect(cipher.decrypt(cipher.encrypt('contraseña ñ 🔑'))).toBe(
      'contraseña ñ 🔑',
    );
  });

  it('does not store the value in clear and uses a new IV each time', () => {
    const cipher = cipherWith(KEY);

    const first = cipher.encrypt('s3cret');
    const second = cipher.encrypt('s3cret');

    expect(first).not.toContain('s3cret');
    expect(first).not.toBe(second);
  });

  it('rejects a value encrypted with another key', () => {
    const encrypted = cipherWith(KEY).encrypt('s3cret');

    expect(() => cipherWith(OTHER_KEY).decrypt(encrypted)).toThrow();
  });

  it('rejects a tampered value', () => {
    const cipher = cipherWith(KEY);
    const bytes = Buffer.from(cipher.encrypt('s3cret'), 'base64');
    bytes[bytes.length - 1] ^= 1;

    expect(() => cipher.decrypt(bytes.toString('base64'))).toThrow();
  });
});
