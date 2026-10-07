export interface LabelProps {
  id: string;
  name: string;
  color: string | null;
  /** Repositorio asociado (normalizado), para que el planificador lea su código. */
  repoUrl: string | null;
}
