import type {
  AttachmentRef,
  StagedAttachment,
} from '@core/attachments/attachments';

/** Contrato de planner con los adjuntos del chat: dejarlos a la vista del agente. */
export interface AttachmentsPort {
  /**
   * Deja los adjuntos en la carpeta `.attachments/` del directorio de trabajo y devuelve dónde quedó cada
   * uno. Los que ya no existen no aparecen en el resultado.
   */
  stage(
    refs: readonly AttachmentRef[],
    workdir: string,
  ): Promise<ReadonlyMap<string, StagedAttachment>>;
}

export const ATTACHMENTS_PORT = Symbol('PLANNER_ATTACHMENTS_PORT');
