import { UsageSnapshot } from '../usage';

export interface UsageSnapshotRepositoryPort {
  save(snapshot: UsageSnapshot): Promise<UsageSnapshot>;
  /** La medida más reciente del plan, o `null` si todavía no hay ninguna. */
  findLatest(): Promise<UsageSnapshot | null>;
  /** La primera medida tomada en ese momento o después. */
  findFirstAtOrAfter(date: Date): Promise<UsageSnapshot | null>;
  /** Todas las medidas tomadas desde esa fecha, de la más antigua a la más nueva. */
  findSince(date: Date): Promise<UsageSnapshot[]>;
}

export const USAGE_SNAPSHOT_REPOSITORY_PORT = Symbol(
  'USAGE_SNAPSHOT_REPOSITORY_PORT',
);
