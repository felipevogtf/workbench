import { ProviderInfo } from '@ai-agents/domain/providers';

/** Qué proveedores existen y qué modelos ofrece cada uno. */
export interface ProviderCatalogPort {
  list(): ProviderInfo[];
}

export const PROVIDER_CATALOG_PORT = Symbol('PROVIDER_CATALOG_PORT');
