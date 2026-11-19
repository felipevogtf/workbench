/** Un proyecto: un repositorio con su receta (cómo se levanta y se prueba), sus dependencias y sus reglas, para los agentes. */
export interface Project {
  id: string;
  /** `organización/repo`. */
  repo: string;
  /** Nombre visible; el del repositorio si no se puso otro. */
  name: string;
  /** El enlace para clonar (github.com o bitbucket.org); `null` si no se conoce. */
  repoUrl: string | null;
  /** La receta, en Markdown. */
  content: string;
  /** Otros repositorios que hay que tener a mano para probar este. */
  dependsOn: string[];
  mainBranch: string;
  /** Clave del entorno en el runner si no es el propio repositorio. */
  runnerEnvironment: string | null;
  /** Reglas de arquitectura, en Markdown. */
  architectureRules: string;
  /** Comando que debe pasar antes de publicar. */
  verifyCommand: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  repo: string;
  content: string;
  dependsOn: string[];
  name: string;
  /** Vacío para quitarlo. */
  repoUrl: string;
  mainBranch: string;
  /** Vacío para quitarla. */
  runnerEnvironment: string;
  architectureRules: string;
  /** Vacío para quitarlo. */
  verifyCommand: string;
}

/** La rama que se propone para un proyecto nuevo. */
export const DEFAULT_MAIN_BRANCH = 'main';

/** Un repositorio al que apunta alguna etiqueta, con los nombres de las etiquetas que lo usan. */
export interface RepositoryOption {
  /** `organización/repo`, en minúsculas. */
  repo: string;
  labels: string[];
}

/** Una rama: sin espacios ni empezar con guion, como valida el servidor. */
export const REF_PATTERN = /^\w[\w./-]*$/;

/** Igual que en el servidor: `organización/repo`. */
export const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/** Lo que se sugiere escribir en una receta nueva. */
export const RECIPE_TEMPLATE = `## Levantar el proyecto
- Comando (compose, overrides, puertos que ocupa):

## Base de datos
- Cómo se llena (migraciones, fixtures o el comando propio):

## Probar
- Pruebas:
- Lint:
- Build:

## No tocar
- `;

/** Los repositorios que escribió el usuario, separados por coma, espacio o salto de línea; sin repetidos. */
export function parseRepos(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter(Boolean))];
}
