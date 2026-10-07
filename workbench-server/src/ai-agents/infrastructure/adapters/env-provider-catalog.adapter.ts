import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderCatalogPort } from '@ai-agents/domain/ports/provider-catalog.port';
import { AgentProvider, ProviderInfo } from '@ai-agents/domain/providers';

const DEFAULTS: Record<AgentProvider, { label: string; models: string[] }> = {
  claude: {
    label: 'Claude',
    models: [
      'claude-sonnet-5-5',
      'claude-opus-5-5',
      'claude-haiku-4-5-20251001',
    ],
  },
  copilot: {
    label: 'GitHub Copilot',
    models: ['auto', 'claude-sonnet-4.5', 'gpt-5'],
  },
  antigravity: {
    label: 'Antigravity',
    models: ['gemini-3.8-flash-medium'],
  },
};

/**
 * Catálogo fijo de proveedores; `AGENT_PROVIDERS` elige cuáles están habilitados. Los modelos de cada uno se pueden reemplazar con una lista separada
 * por comas en `CLAUDE_MODELS`, `COPILOT_MODELS` o `ANTIGRAVITY_MODELS`, porque cada CLI cambia
 * los suyos con frecuencia.
 */
@Injectable()
export class EnvProviderCatalogAdapter implements ProviderCatalogPort {
  constructor(private readonly config: ConfigService) {}

  list(): ProviderInfo[] {
    // AGENT_PROVIDERS=claude,copilot habilita solo esos; vacío o sin definir los habilita todos.
    const configured = this.config
      .get<string>('AGENT_PROVIDERS')
      ?.split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean);
    const enabled = (id: AgentProvider) =>
      !configured?.length || configured.includes(id);

    return (Object.keys(DEFAULTS) as AgentProvider[]).map((id) => {
      const override = this.config
        .get<string>(`${id.toUpperCase()}_MODELS`)
        ?.split(',')
        .map((model) => model.trim())
        .filter(Boolean);
      return {
        id,
        label: DEFAULTS[id].label,
        enabled: enabled(id),
        models: override?.length ? override : DEFAULTS[id].models,
      };
    });
  }
}
