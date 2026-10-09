import { PullRequest } from '@pr-review/domain/entities/pull-request.entity';

export interface ReviewStoragePort {
  /** Guarda el markdown y devuelve la ruta del documento. */
  save(
    pullRequest: PullRequest,
    commit: string,
    markdown: string,
  ): Promise<string>;
  read(docPath: string): Promise<string>;
  /** Borra el documento; si ya no existe no es un error. */
  remove(docPath: string): Promise<void>;
}

export const REVIEW_STORAGE_PORT = Symbol('REVIEW_STORAGE_PORT');
