# Proyectos: un repositorio con su receta, y sesiones sin ticket

Plan acordado en conversación el 2026-11-19. **Estado al 2026-11-19: las etapas 0 a 6 están construidas** (ver «Estado y desviaciones»).

## Por qué

Hoy el workbench solo sirve cuando hay un ticket de Plane:

- Los **repositorios de una tarea salen de las etiquetas** con enlace. Sin etiqueta no hay repo, así que para «trabajar en miflota-web» sin ticket hay que
  fingir una etiqueta (o volver al editor).
- La información de un repositorio está repartida: la receta en `recipes` (por `org/repo`), el entorno en `runner.config.json`, las reglas de revisión
  en `REVIEW_RULES.md` y el vínculo con las tareas en las etiquetas.
- El organizador ([organizador-de-tickets.md](organizador-de-tickets.md)) pide un proyecto y tareas existentes; no hay forma de empezar de cero.

**Objetivo:** que el **proyecto** (un repositorio) sea una entidad propia donde se configura todo lo del repo, y que se pueda abrir una **sesión libre** sobre
uno o varios proyectos, sin ticket de Plane, con un plan que solo se crea cuando se pide.

## Vocabulario (importante: hoy «proyecto» significa dos cosas)

| Término | Qué es | Dónde vive hoy |
|---|---|---|
| **Proyecto** | Un repositorio (`org/repo`) con su receta, rama principal, dependencias, reglas y referencia a su entorno. | `recipes` (la receta es su embrión) |
| **Task-project** | El proyecto *de tareas*: el de Plane (o local) donde viven los tickets. Es lo que hoy se llama `Project` en el módulo `tasks`. | `tasks/domain/entities/project.entity.ts`, `ProjectsStore` |

- En la **interfaz**, «Proyectos» es el repositorio. Lo de Plane se muestra como **«Proyectos»** dentro del menú de gestión (el contexto lo distingue). No se usa «Tablero»: ya es el kanban de las ejecuciones (módulo `kanban`).
- En el **código**, el módulo nuevo se llama `projects` y lo existente de tareas pasa a llamarse **`task-project`** (entidad, puerto, servicio, DTOs, store, rutas).
  Mientras no se haga el renombre, el código nuevo nunca usa `Project` a secas: siempre `RepoProject` en tipos o `projects` como módulo, y se documenta la
  diferencia en el módulo (ver etapa 0).

## Decisiones

- **Un proyecto es un repositorio.** Una clave única `org/repo` (minúsculas, como ya hace `normalizeRepoName`). No se comparte un repo entre proyectos.
- **El proyecto es la receta promovida.** Se amplía la tabla `project_recipes` (y el módulo `recipes` se convierte en `projects`) en vez de crear una entidad
  paralela. Las recetas, las dependencias («Depende de») y los enlaces que ya existen siguen valiendo sin migrar datos.
- **Un ticket apunta a uno o varios proyectos.** Se guarda por clave de repo (igual que hoy las etiquetas y las recetas), sin clave foránea entre módulos.
- **Las etiquetas con enlace siguen funcionando** como respaldo hasta que todo esté migrado; después se decide si se retiran.
- **Lo ejecutable no se edita desde la app.** El entorno sigue en `runner.config.json`; el proyecto solo guarda su nombre y la app lo muestra en lectura
  (por el mismo motivo de seguridad de [recetas-de-proyectos.md](recetas-de-proyectos.md), etapa B).
- **Tickets locales** (sin Plane) viven en un task-project local (ya existen: `Project.createLocal`, `issues.is_local`) y nunca se sincronizan ni se escriben en Plane.
- **El plan solo se crea o cambia cuando se pide** (botón o frase explícita detectada por el servidor, no por el modelo) y se muestra como una **ficha** del chat
  que abre un panel lateral; no está siempre visible.

## Modelo de datos

`projects` (evolución de `project_recipes`; migración que **agrega** columnas, no las quita):

| Campo | Notas |
|---|---|
| `id`, `repo` (único), `content` (receta), `depends_on` | Ya existen. |
| `name` | Nombre visible; por defecto el nombre del repo. |
| `main_branch` | Rama principal. Hoy se asume en varios lados. |
| `runner_environment` | Clave opcional del entorno en `runner.config.json` (solo referencia). |
| `architecture_rules` | Markdown con las reglas de arquitectura (etapa 5). |
| `verify_command` | Comando que debe pasar antes de publicar (etapa 5). Se resuelve en el runner; aquí solo se nombra. |

`issue_projects(issue_id, repo, position)` en el módulo `tasks`: los proyectos de un ticket. Sin FK hacia `projects`; se une por la clave `repo`.

## Arquitectura (hexagonal, igual que los demás módulos)

Cada módulo mantiene `domain` → `application` → `infrastructure`, con puertos en el dominio e inyección por símbolo. Reglas para este cambio:

- **`projects` (módulo nuevo, sale de `recipes`)**
  - `domain/entities/project.entity.ts`: invariantes (clave `org/repo`, tope de receta, dependencias sin ciclo propio ni repetidas). Sin imports de Nest ni de TypeORM.
  - `domain/ports/project-repository.port.ts` (+ símbolo) y puertos de salida que necesite (`RepositoryOptionsPort` ya existe como ejemplo).
  - `application/projects.service.ts`: casos de uso. `application/projects-facade.service.ts`: **única puerta pública** para otros módulos
    (`getByRepo`, `contextFor(repos)`, `list`), igual que `TasksFacade`.
  - `infrastructure/`: `persistence/*.orm-entity.ts`, `repositories/typeorm-*`, `http/projects.controller.ts`, `adapters/` hacia otros módulos.
  - DTOs con `class-validator`; el controller no contiene lógica.
- **`tasks`**
  - `IssueProjectsRepositoryPort` propio (los proyectos de un ticket).
  - **Un solo punto, `projectsOf(issue)`** en `TasksFacade`: primero `issue_projects`, si está vacío cae a las etiquetas. Lo usan los dos adaptadores que arman la
    tarea (`planner/.../tasks-gateway.adapter.ts` y `executions/.../tasks-gateway.adapter.ts`), así no cambia nada aguas abajo.
  - Para saber si un repo tiene proyecto/receta, `tasks` declara un puerto (`ProjectsGatewayPort`) y un adaptador que llama a `ProjectsFacade`.
    **Ningún módulo importa repositorios, entidades ORM ni servicios internos de otro.**
- **`organizer`**: la sesión libre es un caso de uso nuevo en `application`, que usa `TasksFacade` y `ProjectsFacade` por sus puertos.
- **Frontend (`workbench-app`)**: carpeta `projects/` con `data-access` (api + store con signals), `models`, `pages`, `components`, como `tasks` y `organizer`. Componentes
  `OnPush`, standalone, sin lógica de negocio en el template. La pantalla actual de Recetas (`executions/pages/recipes-page`) se mueve ahí y se renombra.
- **Buenas prácticas**: DTOs tipados, errores de dominio con `DomainError`, migraciones con la convención del proyecto (timestamp en el nombre, `up` y `down`),
  tests junto al código (`*.spec.ts`), sin `any`, inmutabilidad en las entidades (como `Agent`), y sin nombres ambiguos de «project».

## Etapas

Cada una se puede usar sola y termina con algo comprobable. No se pasa a la siguiente sin cerrar la anterior.

### Etapa 0: preparar el vocabulario (chica)
- Documentar en `tasks` y en el front que `Project` es el proyecto de tareas; el módulo nuevo no reutiliza ese nombre.
- Nombre en pantalla de lo de Plane: «Proyecto de tareas» (decidido el 2026-11-19; «Tablero» queda para el kanban).
- **Hecha cuando:** el plan de renombre `Project → TaskProject` está listado (archivos y rutas) y se decide si se hace ahora o al final.

### Etapa 1: ampliar la receta a Proyecto (servidor y pantalla)
- Renombrar el módulo `recipes` a `projects` (entidad `Project`, servicio, controller `/projects`, con `/recipes` como alias mientras el front migra).
- Migración que agrega `name`, `main_branch`, `runner_environment` (nulos o con valor por defecto; no se pierde ninguna receta).
- Pantalla **Proyectos** (antes Recetas): lista y editor; muestra, en solo lectura, si el repo tiene entorno en el runner.
- `ProjectsFacade` como única puerta para los prompts de Lucy, el desarrollador y el revisor (hoy usan `recipe-context`).
- **Hecha cuando:** todo funciona como antes, las recetas existentes aparecen como proyectos y los tests del servidor y del front pasan.

### Etapa 2: ticket → proyectos
- Tabla `issue_projects` y `projectsOf(issue)` con respaldo en etiquetas; los dos adaptadores de tareas lo usan.
- En el detalle del ticket se eligen sus proyectos (con los que ya tiene por etiqueta precargados).
- Migración de datos **opcional y reversible**: llena `issue_projects` desde las etiquetas con enlace; lo que no calce con ningún proyecto se **reporta, no se inventa**.
- **Hecha cuando:** para todas las tareas abiertas, `projectsOf` devuelve los mismos repos que antes (comprobado con un script sobre una copia de la base).

### Etapa 3: sesión libre
- «Nueva sesión» sin ticket: se eligen uno o varios proyectos (hasta 3, el tope de repos por ejecución) y se escribe qué se quiere hacer.
- La sesión crea una **tarea local** en un task-project local (por defecto uno «Sesiones libres»; ver preguntas abiertas) con esos proyectos.
- **Tickets locales** creados desde el chat: tareas locales con código propio (`LOC-1`) que se suman al grupo de la sesión; nunca van a Plane.
- **Hecha cuando:** desde cero, sin ticket, se elige un proyecto, se conversa, se crea el plan y se ejecuta con una rama y una PR.

### Etapa 4: el plan bajo demanda y como ficha
- El chat solo conversa y lee código; **no crea ni modifica el plan** salvo el botón «Crear/actualizar plan» o una frase explícita («arma el plan»), detectada en el servidor.
- En el chat aparece una **ficha** del plan («Plan · v3 · actualizado hace 2 min») donde se creó o cambió; al hacer clic se abre en un panel lateral (split).
  Las versiones anteriores quedan en el historial marcadas como reemplazadas.
- «Ejecutar» y el estado del plan van en el **encabezado de la sesión**, no dentro del plan; deshabilitado sin plan, con un aviso.
- **Hecha cuando:** una sesión sin plan no lo crea sola, y con plan se puede abrir y cerrar el panel sin perder el chat.

### Etapa 5: reglas del proyecto
- `architecture_rules` (Markdown) llega a los prompts de Lucy, el desarrollador y el revisor (checklist de arquitectura aparte de la de correctitud).
- `verify_command` (por ejemplo un chequeo de capas): el runner lo corre antes de publicar y **no publica si falla**.
- **Hecha cuando:** un cambio que viola una regla de capas no llega a PR.

### Etapa 6 (opcional): proyecto de tareas con proyectos por defecto
- Un proyecto de tareas (Plane) puede declarar proyectos por defecto, para que sus tickets nuevos ya vengan con repo sin etiquetar a mano.

## Estado y desviaciones

Todo está hecho y probado con tests (servidor 923, app 683, runner 152). Lo que cambió respecto de lo planeado:

- **Etapa 0.** Se renombró `Project → TaskProject` en todo el módulo `tasks` (entidad, puerto, ORM, servicio, controller, DTOs), la ruta HTTP pasó a `/task-projects` y
  la tabla a `task_projects`. En el front, `TaskProjectsStore` y el tipo `TaskProject`. Las pantallas y componentes de tareas conservan su nombre; **en el menú se sigue
  llamando «Proyectos»** (decisión del usuario: el contexto distingue la gestión de tareas de los proyectos-repositorio, que están en Automatización).
- **Etapa 1.** La tabla `project_recipes` pasó a llamarse `projects` (la de tareas quedó libre al renombrarse). El proyecto ganó `name`, `main_branch`,
  `runner_environment`, `architecture_rules` y `verify_command`. La API sigue aceptando `/recipes` como alias de `/projects` por si hay una pantalla vieja abierta.
- **Etapa 2.** En vez de una tabla `issue_projects` se usó una columna `project_repos` (jsonb) en `issues`: un ticket guarda hasta 3 `org/repo`. Hizo falta algo
  que el plan no vio: el proyecto necesita el **enlace de su repositorio** (`repo_url`, github o bitbucket) para poder clonarlo, porque `org/repo` no dice el host. La
  migración lo rellena desde las etiquetas que apuntan a ese repo. Los repos de una tarea salen de sus proyectos y, si no tiene (o ninguno tiene enlace), de sus etiquetas, como antes.
  Lo resuelven los dos adaptadores de tareas con `ProjectsFacade.linksFor`.
- **Etapa 3.** La sesión libre es una sesión de grupo sin miembros: su tarea-grupo vive en un proyecto de tareas local «Sesiones libres» (se crea sola la primera vez) y lleva
  sus `project_repos`. Los tickets locales se crean desde el panel de la sesión (no desde el chat) y entran al final del grupo con los mismos proyectos. **No se usó el
  código `LOC-n`**: los tickets locales ya existían y se ven como `#n`; la rama no lleva código, como siempre en tareas locales. Las horas siguen el proyecto de tareas local.
- **Etapa 4.** «El plan solo se crea o cambia cuando se pide» ya era así (el chat marca `[[ACTUALIZAR_PLAN]]` solo si el usuario lo pide y el servidor aplica el cambio);
  no se tocó. Lo nuevo es la pantalla: el chat ocupa todo el ancho y el plan y los tickets se abren desde fichas («Plan · v3», «Tickets · n») en un split a la derecha.
  La ficha está sobre el chat, no dentro de la conversación: ponerla en el punto exacto donde se creó el plan exige cambiar el componente de chat compartido y queda pendiente.
- **Etapa 5.** Las reglas de arquitectura entran en el contexto que ya reciben Lucy, el desarrollador y el revisor (también las de los proyectos de los que dependen). La verificación
  la corre el runner **antes de subir la rama**: el servidor manda solo el *nombre* (`verify` en el trabajo `publish`) y el runner busca el comando en su configuración
  (`verifications` en `runner.config.json`: nombre → programa y argumentos, sin shell, en el worktree y con las variables del entorno de la ejecución). Si falla, no se publica;
  si el runner no conoce el nombre, publica y lo deja dicho en el registro. Nada que se edite en la app puede ejecutar comandos en el PC.
- **Etapa 6.** El proyecto de tareas (también los de Plane) puede declarar proyectos por defecto (`default_project_repos`); sirven a las tareas que no tienen los suyos. Orden:
  los de la tarea (o su grupo) → los del proyecto de tareas → las etiquetas.

## Repos compartidos del servidor (2026-11-19)

El servidor ya no clona el mismo repositorio una vez por tarea, por PR y en cada revisión. `RepoMirrorService` (`core/git/repo-mirror.ts`) mantiene **un clon completo y
sin carpeta de trabajo por repositorio** (`/data/repos/mirrors/<host>/<org>/<repo>.git`, sin importar mayúsculas): se clona la primera vez y después solo se traen los cambios
(`fetch --prune` de todas las ramas, de a una operación por repo). Quien necesita ver una rama lo hace en su **propio worktree desprendido** (no se pisan entre sí y no copian objetos):

- Planificador y chat de tareas: `tasks/<tarea>/<repo>` en `main` (o `master`); las ramas de otros tickets que la tarea menciona, en `<repo>@<clave>`.
- Chat de PRs: `prs/<PR>`, llevado al último commit de la rama de la PR.
- Revisión automática de PRs: un worktree desechable que se borra al terminar. Exige lo último del proveedor (si no puede traerlo, falla en vez de revisar código viejo).

El token solo se usa para el `fetch` y nunca queda en la configuración del mirror. Si no se puede actualizar, el planificador y el chat siguen con la copia anterior y lo dicen. Un mirror que nadie
pide en 30 días se borra solo; los worktrees de tareas y PRs, a los 7. Un solo volumen `repos` reemplaza a `chat_repos` y `task_repos`. El runner de tu PC no cambia: tiene su propio clon y
worktrees por ejecución.

## Etiquetas y enlaces (2026-11-19)

- **Una etiqueta apunta a un proyecto** (`labels.project_repo`, `org/repo`), ya no guarda un enlace propio: el enlace se cambia solo en el proyecto. La migración `LabelsPointToProjects` convierte el enlace de cada etiqueta en su proyecto (crea el proyecto si el repo solo existía como enlace de etiqueta) y borra `labels.repo_url`.
- **El enlace del proyecto ya no tiene que coincidir con su `org/repo`**: al migrar de Bitbucket a GitHub la organización o el nombre pueden cambiar; `org/repo` queda como identificador estable del proyecto.
- **Cambiar el enlace mueve la copia del servidor**: se prepara el mirror del enlace nuevo (en segundo plano) y se borra el del anterior, salvo que otro proyecto aún lo use. Borrar un proyecto también borra su mirror. Los worktrees que salieron del mirror viejo se rehacen la próxima vez que se piden.
- Al crear un proyecto, el repositorio se completa solo desde el enlace mientras no se haya escrito a mano.

## Pendiente

- Probar la sesión libre y la verificación con una ejecución real (los tests usan repos locales de juguete).
- Poner la ficha del plan dentro de la conversación (en el mensaje donde se creó) en vez de sobre el chat.
- Crear tickets locales desde lo que dice la IA en el chat (hoy se crean a mano en el panel de la sesión).
- Imputación de horas de las sesiones libres en el dashboard (hoy cuentan en el proyecto de tareas local «Sesiones libres»).
- Renombrar en el front los componentes `project-*` de tareas a `task-project-*`.

## Pruebas

- **Servidor:** entidad (invariantes), servicio y facade; `projectsOf` con y sin `issue_projects` y con respaldo de etiquetas; migraciones (`up` y `down`) sobre datos de ejemplo.
- **Comparación antes/después** (etapa 2): para cada tarea abierta, mismos repos con el código viejo y el nuevo.
- **Runner:** `verify_command` bloquea la publicación cuando falla.
- **App:** lista y editor de proyectos, selector de proyectos del ticket, sesión libre y ficha del plan con su store, como los de `tasks` y `organizer`.
- **Aceptación con datos reales:** una sesión libre sobre `miflota-web` hasta una PR, y un ticket de Plane con dos proyectos hasta dos PRs.

## Riesgos

- **Dos significados de «proyecto»** durante la transición: por eso la etapa 0 y el nombre `task-project`.
- **Renombre grande** (`Project → TaskProject`) toca muchos archivos del servidor y del front; se hace en un commit aparte y mecánico, no mezclado con funcionalidad.
- **Etiquetas que no calzan** con ningún proyecto: la migración las reporta.
- **Recetas huérfanas** (repos que ninguna etiqueta usa): se ven en la pantalla, sin tocarlas.
- **Ejecutable en la app:** `verify_command` y `runner_environment` se guardan en el servidor pero el **runner** decide qué se ejecuta (su configuración manda); si no, quien edite un
  proyecto podría hacer correr comandos en tu PC.

## Preguntas abiertas

- ¿El renombre `Project → TaskProject` se hace al principio o al final?
- Horas: una sesión libre no tiene ticket de Plane; hoy se imputa al proyecto de tareas local «Sesiones libres». ¿Alcanza o quieres otra categoría en el dashboard?
- Dónde corre cada tipo de trabajo (servidor o runner) queda en otro plan.

## Lo que ya existe y se reutiliza

- Módulo `recipes` (entidad, repositorio, controller, `recipe-context` con dependencias a 2 niveles) y su pantalla.
- `TasksFacade` y los dos adaptadores de tareas como único punto por donde se arma la tarea.
- Tareas locales y task-projects locales (`is_local`, `Project.createLocal`).
- Organizador: sesiones, chat, plan y ejecución sobre una tarea-grupo.
- `normalizeRepoName` y `normalizeRepoUrl` para las claves y enlaces de repo.
