# CodeGraph para los agentes: piloto propuesto

Idea del 2026-10-27, sin construir. Parte de [optimizacion-de-tiempos.md](optimizacion-de-tiempos.md): que Lucy, el desarrollador y el revisor
encuentren el código sin explorar archivo por archivo.

## Qué es

[CodeGraph](https://github.com/colbymchenry/codegraph) (colbymchenry, MIT) indexa un proyecto en un grafo de conocimiento local: símbolos,
llamadas, importaciones y herencia, con búsqueda de texto completo. El agente pide en una sola consulta los símbolos, sus rutas de
llamadas y el código, en vez de varias rondas de `grep` y lectura.

- **Indexado:** tree-sitter (kernel nativo en Rust) y SQLite local en `.codegraph/` dentro del proyecto. Sin servicios ni IA. Ignora
  dependencias, carpetas de build, lo del `.gitignore` y archivos de más de 1 MB.
- **Mantenerlo al día:** un observador de archivos re-sincroniza a los 2 s de un cambio (configurable). Al reconectar se pone al día con
  lo editado mientras no corría (tamaño, fecha y hash). Las respuestas avisan de los archivos pendientes.
- **Lenguajes:** unos 40. **PHP** (`.php`) y **TypeScript** (`.ts`, `.tsx`) con soporte completo: cubren Symfony y Angular/Ionic.
- **Integración con Claude Code:** `codegraph install` agrega su servidor MCP (`codegraph serve --mcp`, con `alwaysLoad` para cargarlo desde
  el primer mensaje) y escribe en `CLAUDE.md` cómo usar la consulta. Por defecto expone **una** herramienta: `codegraph_explore`.
  `codegraph init` construye el índice de cada proyecto.

## Por qué puede servir aquí

- Lucy ya sugiere los archivos de cada ticket, pero a partir de lo que lee. Un grafo le da el punto de partida sin leer.
- `codebase-memory-mcp` no se usaba de forma fiable porque la IA prefiere `Grep` y `Read`. Con **una sola herramienta** siempre cargada
  hay menos que elegir y más probabilidad de que se use.
- Es local y sin costo por indexar, a diferencia de las herramientas que usan un modelo para extraer.

## Reservas

- Las cifras de su página (88% menos llamadas a herramientas, 53% más rápido, 62% menos tokens, 44% más barato) son **propias**: medianas de
  4 corridas en siete repos, con Claude Opus 4.8 y la CLI bloqueada en el grupo de control. Dos de los repos son VS Code y Excalidraw,
  mucho más grandes que los de este proyecto: en repos chicos se espera menos ganancia.
- Según su propia página, deja un 80% más de contexto residente al final de la sesión (67k contra 18k tokens en VS Code). Es un costo en
  trabajos largos.
- Que cubra bien el PHP de Symfony y el TypeScript de estos repos hay que comprobarlo; el 100% de cobertura que reporta es para guzzle.

## Cómo encajaría en el runner

1. **Índice por repo.** Un `codegraph init` en el clon de cada repo (dentro de la distro `wb-agents`), que se mantiene con `codegraph sync` en
   cada `git fetch`. Los worktrees cambian de rama: hay que decidir si cada uno tiene su propio índice (más disco y tiempo) o si todos
   consultan el del clon (menos exacto en una rama con cambios).
2. **Que no llegue a un commit.** `.codegraph/` queda dentro del repo: hay que excluirlo con `info/exclude` del worktree, igual que
   `.wb-scratch/` (`scratch.ts`), o el commit del desarrollador lo incluiría.
3. **Pasarle la herramienta a Claude.** El runner tendría que armar la configuración MCP de la llamada (`claude.ts`) y permitir
   `mcp__codegraph__codegraph_explore`, que es de solo lectura. Entra en `effectiveTools` como las demás, así que el servidor la autoriza
   por agente.
4. **Orientarlos en el prompt.** Una línea en los prompts de desarrollo, revisión, tickets y chat: «para ubicar código usa primero
   `codegraph_explore`». Sin eso la IA tiende a no usarla.

## Piloto propuesto

Con la medición de tiempos ya activa en el runner (desplegada el 2026-10-27, commit `8ac5a0a`):

1. Instalar CodeGraph en la distro y correr `codegraph init` en el clon de `melon-web`. Revisar a mano que indexe bien el PHP y el
   TypeScript de ese repo (símbolos, llamadas entre archivos).
2. Hacer dos ejecuciones del **mismo tipo de ticket**, una con y otra sin CodeGraph, y comparar con el registro de cada trabajo: tiempo
   de la fase `IA`, cantidad de llamadas a herramientas y costo en dólares.
3. Decidir con esos datos: si el ahorro es claro (por ejemplo, tiempo o costo de desarrollo y revisión a la mitad o menos), integrarlo al
   runner con los pasos de arriba; si no, descartarlo.

## Alternativas vistas

- **Graphify** (safishamsi/graphify): también usa tree-sitter y genera `GRAPH_REPORT.md` y `graph.json`; el reporte se puede pegar directo
  en el prompt, así no depende de que la IA llame una herramienta. Usa un modelo para los documentos que no son código.
- **`codebase-memory-mcp`:** ya instalado en la máquina de desarrollo, pero la IA no lo usa de forma fiable.
- **Mapa del repo en el prompt** (rutas y firmas con `ctags` o tree-sitter): menos sofisticado, pero se aprovecha siempre.
- Otros proyectos llamados «codegraph» (token-codegraph, code-graph-mcp, codegraph-smart-mcp): no son el mismo y no se evaluaron.
