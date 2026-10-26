import { GitProvider } from '@pr-review/domain/entities/pull-request.props';

export interface NewPullRequestData {
  /** `organización/repo`. */
  repo: string;
  sourceBranch: string;
  destBranch: string;
  title: string;
  description: string;
  /** Quiénes revisan, por su identificador en el proveedor (los que no se puedan asignar se omiten). */
  reviewerIds: string[];
}

export interface PullRequestCreationPort {
  readonly provider: GitProvider;
  /** Abre la PR y devuelve su enlace. */
  create(data: NewPullRequestData): Promise<{ url: string }>;
}

export const PULL_REQUEST_CREATION_PORTS = Symbol(
  'PULL_REQUEST_CREATION_PORTS',
);
