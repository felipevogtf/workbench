# CodeGraph para los agentes: piloto en marcha

Idea del 2026-10-27; **instalado y activo desde esa tarde para `melon-web` y `melon-ionic`** (ver «Estado del piloto»). Parte de [optimizacion-de-tiempos.md](optimizacion-de-tiempos.md): que Lucy, el desarrollador y el revisor
encuentren el código sin explorar archivo por archivo.

## Estado del piloto (2026-10-27, tarde)

- **Instalado** con `npm i -g @colbymchenry/codegraph` como usuario `agent` en `wb-agents` (no se usó `codegraph install`, que toca la
  configuración de Claude). La telemetría y la búsqueda de actualizaciones se apagan con `CODEGRAPH_TELEMETRY=off`, `DO_NOT_TRACK=1` y
  `CODEGRAPH_NO_UPDATE_CHECK=1` (por defecto envía eventos anónimos a `telemetry.getcodegraph.com`); el runner las pone al arrancar su
  servidor y al sincronizar.
- **Índices en los clones** (`/home/agent/work/repos/<repo>/.codegraph`): `melon-web` 2.432 archivos, 41.068 nodos, 232 MB, 155 s para
  indexar; `melon-ionic` 283 archivos, 12 MB, 2 s. En `melon-web` casi 1.000 archivos son plugins JS de terceros (`web/assets`); CodeGraph no
  mostró cómo excluirlos, así que el índice pesa más de lo necesario.
- **Cómo lo usa el runner** (`workbench-runner/src/codegraph.ts`, config `codegraph: { bin, repos }` en `runner.config.json`):
  1. Para cada repo con índice (el de la tarea y los de consulta), copia el `.codegraph/` del clon al worktree la primera vez y corre
     `codegraph sync` para ponerlo al día con la rama. Queda fuera de git (`info/exclude`).
  2. Le pasa a Claude el servidor MCP (`--mcp-config`) y agrega la herramienta de solo lectura `mcp__codegraph__codegraph_explore` a las
     herramientas del trabajo (la decide el runner, como el entorno; no hay cambios en el servidor).
  3. Agrega al prompt una sección «Grafo del código» con la instrucción de consultarlo primero y el `projectPath` de cada repo.
  4. Si el repo no tiene índice o algo falla, el trabajo sigue como antes. Se aplica a Lucy, desarrolladores, revisores, revisión final y
     chat. El planificador (que corre en el servidor) no lo usa todavía.
- **Pendiente / a vigilar:** el índice del clon no se actualiza solo (el clon no avanza de rama), así que con el tiempo el `sync` de cada
  worktree tendrá más diferencias; conviene un `codegraph sync` periódico del clon o regenerarlo. Si el índice de 232 MB hace lento armar el
  worktree, la fase `codegraph` del registro del trabajo lo mostrará.
- **Cómo medir:** cada trabajo registra `⏱ … codegraph X s · IA Y s`. Comparar la fase `IA` y el costo con la ejecución base `6aa948cf…`
  (776 s en total; IA ~450 s; sin CodeGraph).

## Repos con índice (2026-10-28)

Los 11 clones de `<workDir>/repos/`: `melon-web` (232 MB), `melon-ionic` (12 MB), `melontienda-web` (52 MB), `miobra-web` (17 MB), `miobra-ionicv6` (6 MB),
`miplanta-web` (176 MB), `miplanta-ionic` (7 MB), `miseguridad-web` (50 MB), `miseguridad-ionic` (13 MB), `melon-volumenes-web` (1,7 MB) y `melon-volumenes-pwa`
(24 MB). Todos están en `codegraph.repos`. Un repo nuevo necesita su `codegraph init` y entrar en esa lista (se hizo con un script al agregar
`melontienda-web`).

## Cuándo se crea y se actualiza el índice (2026-10-28)

- **Se crea una vez por repo, a mano:** `codegraph init` en el clon (`/home/agent/work/repos/<repo>`), y el repo se agrega a `codegraph.repos`.
  El runner no crea índices solo.
- **El índice del clon sigue a la rama base.** Al armar un worktree nuevo, antes de copiarle el índice, el runner compara `origin/HEAD` con el
  commit anotado en `.codegraph/indexed-at`. Si la rama base avanzó, adelanta el clon (`git reset --hard`; el clon no se usa para trabajar),
  corre `codegraph sync` (incremental, ~1 s si hay pocos cambios) y anota el commit. Si no avanzó, no hace nada. Un fallo deja el índice
  anterior y queda en el registro del trabajo.
- **En cada worktree:** copia el índice del clon la primera vez y corre `sync` al comienzo de cada trabajo; durante el trabajo el servidor MCP
  re-sincroniza solo cuando el agente edita archivos.

## Verificación de que los agentes lo usan (2026-10-27, noche)

- **Primeras dos ejecuciones con CodeGraph (`97ec4f02…` y `5b8a0cb0…`): 0 llamadas** en todos los trabajos. La instrucción estaba al final del
  prompt. Se movió **al comienzo del prompt y a una regla en el prompt de sistema** (commit `18bfcea`).
- **Aun así Lucy no lo usó en `5b8a0cb0…`**, pero la causa no era la instrucción: ese ticket (límites de subida de nginx y PHP) es de
  configuración, y para eso `grep` sobre archivos de configuración es lo natural; CodeGraph indexa símbolos de código, no `nginx.conf` ni
  `php.ini`, ni el código de `vendor/`.
- **Prueba aparte con el mismo agente** (`default-task-tickets`: Opus, esfuerzo medio, su prompt de sistema más la regla, la sección al
  comienzo del prompt y el mismo `--allowedTools`) sobre un ticket de código (cambiar «cancelada» por «anulada» en una notificación):
  **llamó a `codegraph_explore` antes que a `Grep`, 4 veces**, con el `projectPath` correcto, y usó `Grep` solo para buscar textos literales.
  La herramienta responde bien y el servidor MCP queda `connected` dentro de `claude -p`.
- **Conclusión:** para medir el beneficio hay que usar tickets de código (lógica, controladores, servicios), no de infraestructura. En los
  de configuración el agente acierta al no usarlo.

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

## Quién lo aprovecha: todos los agentes (2026-10-27)

El objetivo es que **todos** los agentes le saquen provecho: Lucy (planifica y decide qué archivos toca cada ticket, así que un buen punto
de partida suyo ahorra trabajo a los demás), el planificador, los desarrolladores, los revisores y la revisión final. Empezar por Lucy da la
medición más clara; el resto sale casi gratis si el índice y la herramienta ya están en el runner.

| Agente | Trabajo | Dónde corre |
|---|---|---|
| Lucy | tickets, chat | runner |
| Planificador | el plan de la tarea | servidor |
| Desarrolladores (simple, medio, complejo) | `develop` | runner |
| Revisores y revisión final | `review`, `final` | runner |

Los trabajos de Lucy, con sus tiempos:

| Trabajo de Lucy | Dónde corre | Duración media (14 días) | Costo medio |
|---|---|---|---|
| Crear los tickets (`tickets`) | runner (con el entorno levantado) | 83 s | 0.39 USD (el trabajo más caro) |
| Chat sobre la tarea o la ejecución (`chat`) | runner | 70 s | 0.27 USD |
| El plan de la tarea (planificador) | servidor, con su propia copia de los repos (`git-repos-checkout`) | sin medir | sin medir |

- **Tickets y chat** son los que el piloto debe medir primero: son de Lucy, corren en el runner y `tickets` es hoy el trabajo más caro por
  unidad. Si CodeGraph le ahorra explorar, se nota ahí (tiempo, costo y cantidad de llamadas a herramientas).
- **El plan** se genera en el servidor, no en el runner: para que se beneficie hay que instalar CodeGraph también en el contenedor del
  servidor e indexar su copia de cada repo (`git-repos-cache`). Es una segunda integración, aparte de la del runner. Antes de hacerla hay
  que medir cuánto tarda hoy el plan (no se guarda como los trabajos del runner).
- Con varios repos por tarea (`melon-web` y `melon-ionic`), Lucy mira todos: el índice tiene que cubrir cada repo de consulta, no solo el
  principal.
- Los agentes del runner comparten una sola integración: el permiso `mcp__codegraph__codegraph_explore` se agrega a las herramientas de
  cada agente (solo lectura, también para el revisor) y una línea en cada prompt indica usarla antes de leer archivos. A Lucy además se le pide
  que la use para llenar el campo de archivos previstos de cada ticket, que después reciben el desarrollador y el revisor.
- Un solo índice por repo sirve a todos los agentes de una ejecución (ver «Cómo encajaría en el runner»).

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
   de la fase `IA`, cantidad de llamadas a herramientas y costo en dólares. **Empezar por los trabajos de Lucy** (`tickets` y `chat`) y
   mirar también si los archivos previstos que propone coinciden con los que de verdad se tocan.
   La corrida base (sin CodeGraph) es la ejecución `6aa948cf…`, lanzada el 2026-10-27 con la opción de no abrir la PR.
3. Decidir con esos datos: si el ahorro es claro (por ejemplo, tiempo o costo de desarrollo y revisión a la mitad o menos), integrarlo al
   runner con los pasos de arriba; si no, descartarlo.

## Alternativas vistas

- **Graphify** (safishamsi/graphify): también usa tree-sitter y genera `GRAPH_REPORT.md` y `graph.json`; el reporte se puede pegar directo
  en el prompt, así no depende de que la IA llame una herramienta. Usa un modelo para los documentos que no son código.
- **`codebase-memory-mcp`:** ya instalado en la máquina de desarrollo, pero la IA no lo usa de forma fiable.
- **Mapa del repo en el prompt** (rutas y firmas con `ctags` o tree-sitter): menos sofisticado, pero se aprovecha siempre.
- Otros proyectos llamados «codegraph» (token-codegraph, code-graph-mcp, codegraph-smart-mcp): no son el mismo y no se evaluaron.
