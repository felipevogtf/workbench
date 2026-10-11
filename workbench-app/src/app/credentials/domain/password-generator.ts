export const MIN_LENGTH = 8;
export const MAX_LENGTH = 64;

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  /** Deja fuera los caracteres que se confunden al leerlos (I, l, 1, O, 0). */
  avoidAmbiguous: boolean;
}

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: false,
};

/** Los grupos de caracteres que se pueden activar o desactivar. */
export type CharacterSet = 'uppercase' | 'lowercase' | 'digits' | 'symbols';

export const CHARACTER_SETS: readonly CharacterSet[] = [
  'uppercase',
  'lowercase',
  'digits',
  'symbols',
];

const POOLS: Record<CharacterSet, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
};

const AMBIGUOUS = /[Il1O0]/g;

/** Un entero al azar en `[0, max)`. */
export type RandomInt = (max: number) => number;

/** Entero al azar con `crypto.getRandomValues`; descarta los valores que sesgarían el resultado. */
export const secureRandomInt: RandomInt = (max) => {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
};

/** Los grupos de caracteres activos (sin los ambiguos si así se pidió). */
export function activePools(options: PasswordOptions): string[] {
  return CHARACTER_SETS.filter((set) => options[set])
    .map((set) => (options.avoidAmbiguous ? POOLS[set].replace(AMBIGUOUS, '') : POOLS[set]))
    .filter((pool) => pool.length > 0);
}

export function clampLength(length: number): number {
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(length)));
}

/**
 * Genera una contraseña con al menos un carácter de cada grupo activo y el resto al azar entre
 * todos; después se mezcla, para que los garantizados no queden siempre al principio.
 */
export function generatePassword(
  options: PasswordOptions,
  randomInt: RandomInt = secureRandomInt,
): string {
  const pools = activePools(options);
  if (pools.length === 0) throw new Error('Activa al menos un tipo de carácter');

  const all = pools.join('');
  const chars = pools.map((pool) => pool[randomInt(pool.length)]);
  while (chars.length < clampLength(options.length)) chars.push(all[randomInt(all.length)]);

  // Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export type StrengthLevel = 'weak' | 'fair' | 'strong' | 'very-strong';

export interface Strength {
  level: StrengthLevel;
  bits: number;
  /** De 0 a 1, para dibujar la barra. */
  ratio: number;
}

const STRONGEST_BITS = 100;

/** Fortaleza según la entropía: longitud × log2(caracteres posibles). */
export function strengthOf(options: PasswordOptions): Strength {
  const poolSize = new Set(activePools(options).join('')).size;
  const bits = poolSize > 1 ? clampLength(options.length) * Math.log2(poolSize) : 0;
  const level: StrengthLevel =
    bits < 40 ? 'weak' : bits < 60 ? 'fair' : bits < STRONGEST_BITS ? 'strong' : 'very-strong';
  return { level, bits, ratio: Math.min(1, bits / STRONGEST_BITS) };
}
