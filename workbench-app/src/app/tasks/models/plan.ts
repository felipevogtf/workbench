export type PlanStatus = 'pending' | 'generating' | 'ready' | 'failed';

/** Un repositorio que se intentó leer para el plan. */
export interface PlanRepo {
  url: string;
  name: string;
  /** `false`: no se pudo clonar y el plan se hizo sin él. */
  used: boolean;
  note: string | null;
}

export interface Plan {
  id: string;
  issueId: string;
  status: PlanStatus;
  agentName: string | null;
  model: string | null;
  repos: PlanRepo[];
  error: string | null;
  /** Solo viene al pedir un plan por su id (el historial no lo trae). */
  content?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanRequest {
  agentId?: string;
}

/** En cola o generándose: mientras haya uno, el panel se refresca solo. */
export function isPlanActive(plan: Pick<Plan, 'status'>): boolean {
  return plan.status === 'pending' || plan.status === 'generating';
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  pending: 'En cola',
  generating: 'Generando',
  ready: 'Listo',
  failed: 'Falló',
};

/** `https://github.com/org/repo` → `org/repo`. */
export function repoShortName(url: string): string {
  return url.replace(/^https:\/\/[^/]+\//, '');
}
