import { normalizeRepoName, type Project } from './entities/project.entity';

/** Hasta cuántos saltos se siguen las dependencias (la app depende de la web, la web de la base…). */
export const MAX_DEPENDENCY_DEPTH = 2;
/** Tope de cada receta dentro del contexto: lo que pase se recorta. */
export const MAX_RECIPE_CONTEXT_CHARS = 6_000;
/** Tope de las reglas de arquitectura de cada proyecto dentro del contexto. */
export const MAX_RULES_CONTEXT_CHARS = 4_000;

function clip(value: string, max = MAX_RECIPE_CONTEXT_CHARS): string {
  return value.length > max ? `${value.slice(0, max)}\n[... recortado]` : value;
}

/** Las reglas de arquitectura y la verificación del proyecto, si las tiene: lo que no se puede romper al desarrollar y al revisar. */
function rulesOf(project: Project): string[] {
  const lines: string[] = [];
  if (project.architectureRules) {
    lines.push(
      `### Reglas de arquitectura de ${project.repo} (obligatorias: quien desarrolla las respeta y quien revisa las comprueba)`,
      clip(project.architectureRules, MAX_RULES_CONTEXT_CHARS),
    );
  }
  if (project.verifyCommand) {
    lines.push(
      `### Verificación de ${project.repo}`,
      `Antes de publicar la rama se corre la verificación «${project.verifyCommand}»; si falla, la rama no se publica. Corre lo equivalente tú también antes de terminar, si puedes.`,
    );
  }
  return lines;
}

/**
 * Lo que se le muestra a un agente de las recetas de los repositorios de la tarea: la de cada uno y, debajo,
 * la de los repositorios de los que dependen (hasta `MAX_DEPENDENCY_DEPTH` saltos), cada receta una sola vez
 * aunque haya ciclos. Una dependencia sin receta escrita solo deja un aviso. Los repositorios de la tarea que
 * no tienen receta no aportan nada. `null` si no hay nada que mostrar. Función pura.
 */
export function buildRecipeContext(
  repos: readonly string[],
  recipes: readonly Project[],
): string | null {
  // Las recetas se guardan en minúsculas; el repositorio de la tarea puede venir como lo escribió la etiqueta.
  const byRepo = new Map(recipes.map((recipe) => [recipe.repo, recipe]));
  const shown = new Set<string>();
  const missing = new Set<string>();
  const sections: string[] = [];

  const visit = (name: string, depth: number, neededBy: string | null) => {
    const repo = normalizeRepoName(name);
    if (shown.has(repo)) return;
    const recipe = byRepo.get(repo);
    if (!recipe) {
      // Una raíz sin receta no es un aviso: solo se avisa de lo que otra receta pide.
      if (neededBy) missing.add(repo);
      return;
    }
    shown.add(repo);
    sections.push(
      [
        neededBy
          ? `## Receta de ${repo} (repositorio del que depende ${neededBy})`
          : `## Receta de ${repo}`,
        recipe.content ? clip(recipe.content) : '(la receta está vacía)',
        ...rulesOf(recipe),
      ].join('\n'),
    );
    if (depth >= MAX_DEPENDENCY_DEPTH) return;
    for (const dependency of recipe.dependsOn) {
      visit(dependency, depth + 1, repo);
    }
  };

  for (const repo of repos) visit(repo, 0, null);

  if (sections.length === 0) return null;
  const notes = [...missing]
    .filter((repo) => !shown.has(repo))
    .map((repo) => `(${repo} no tiene una receta escrita todavía)`);
  return [...sections, ...notes].join('\n\n');
}
