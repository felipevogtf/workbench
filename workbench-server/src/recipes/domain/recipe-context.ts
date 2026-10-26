import { normalizeRepoName, type Recipe } from './entities/recipe.entity';

/** Hasta cuántos saltos se siguen las dependencias (la app depende de la web, la web de la base…). */
export const MAX_DEPENDENCY_DEPTH = 2;
/** Tope de cada receta dentro del contexto: lo que pase se recorta. */
export const MAX_RECIPE_CONTEXT_CHARS = 6_000;

function clip(value: string): string {
  return value.length > MAX_RECIPE_CONTEXT_CHARS
    ? `${value.slice(0, MAX_RECIPE_CONTEXT_CHARS)}\n[... recortado]`
    : value;
}

/**
 * Lo que se le muestra a un agente de las recetas de los repositorios de la tarea: la de cada uno y, debajo,
 * la de los repositorios de los que dependen (hasta `MAX_DEPENDENCY_DEPTH` saltos), cada receta una sola vez
 * aunque haya ciclos. Una dependencia sin receta escrita solo deja un aviso. Los repositorios de la tarea que
 * no tienen receta no aportan nada. `null` si no hay nada que mostrar. Función pura.
 */
export function buildRecipeContext(
  repos: readonly string[],
  recipes: readonly Recipe[],
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
