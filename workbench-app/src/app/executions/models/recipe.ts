/** La receta de un proyecto: cómo se levanta y se prueba ese repositorio, para los agentes. */
export interface Recipe {
  id: string;
  /** `organización/repo`. */
  repo: string;
  /** Markdown. */
  content: string;
  /** Otros repositorios que hay que tener a mano para probar este. */
  dependsOn: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  repo: string;
  content: string;
  dependsOn: string[];
}

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
