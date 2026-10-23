export interface RunnerProps {
  id: string;
  name: string;
  /** SHA-256 del token: el token en sí solo se muestra al crearlo. */
  tokenHash: string;
  version: string | null;
  host: string | null;
  lastSeenAt: Date | null;
  /** El runner que toma el trabajo primero y al que la app intenta despertar. Solo hay uno. */
  isDefault: boolean;
  createdAt: Date;
}
