export type PlanStatus = 'pending' | 'generating' | 'ready' | 'failed';

/** Un repositorio que se intentó leer para el plan. */
export interface PlanRepoInfo {
  url: string;
  /** Carpeta donde quedó el clone (relativa al directorio de trabajo del agente). */
  name: string;
  /** `false` si no se pudo clonar (el plan se hizo sin él). */
  used: boolean;
  /** Motivo cuando no se usó. */
  note: string | null;
}

export interface PlanProps {
  id: string;
  issueId: string;
  status: PlanStatus;
  /** Markdown del plan, cuando está listo. */
  content: string | null;
  /** Lo que se pidió al encolar (vacío = el agente y el modelo por defecto). */
  requestedAgentId: string | null;
  requestedModel: string | null;
  /** Instantánea de quién lo generó. */
  agentId: string | null;
  agentName: string | null;
  model: string | null;
  repos: PlanRepoInfo[];
  error: string | null;
  queuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
