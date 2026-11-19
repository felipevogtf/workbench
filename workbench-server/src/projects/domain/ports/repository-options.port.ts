/** Un repositorio al que apunta alguna etiqueta, con los nombres de las etiquetas que lo usan. */
export interface RepositoryOption {
  /** `organización/repo`, en minúsculas. */
  repo: string;
  labels: string[];
}

export interface RepositoryOptionsPort {
  /** Los repositorios que tienen alguna etiqueta con su enlace, por nombre. */
  list(): Promise<RepositoryOption[]>;
}

export const REPOSITORY_OPTIONS_PORT = Symbol(
  'RECIPES_REPOSITORY_OPTIONS_PORT',
);
