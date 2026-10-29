import type { AttachmentRef } from '@core/attachments/attachments';
import type { RelatedBranch } from '../related-branches';

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
  /** Ramas de otros tickets que la tarea menciona, clonadas aparte para poder verificar lo que de ellas depende. */
  branches?: RelatedBranch[];
}

/** Un mensaje de la conversación con la que se pidió una replanificación. */
export interface PlanChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: AttachmentRef[];
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
  /** Conversación con la que se pidió este plan (replanificación); null en un plan normal. */
  conversation: PlanChatMessage[] | null;
  /** El plan del que parte (el último listo al pedir la replanificación); null si no había. */
  basedOnPlanId: string | null;
  error: string | null;
  queuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
