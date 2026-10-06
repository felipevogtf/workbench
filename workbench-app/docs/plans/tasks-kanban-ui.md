# Plan: frontend de Tareas y Kanban (Angular 21)

Estado: **implementado** (decisiones en la sección 12 y detalle en la 14; las secciones 3, 8 y 10 conservan el
planteamiento original y la 14 indica dónde la implementación difiere). Cubre los módulos **Tareas** (tareas, proyectos, estados y etiquetas) y
**Kanban** del `workbench-app`. Continúa [pr-review-ui.md](./pr-review-ui.md): mismo estilo visual (el del
portfolio), mismas convenciones de Angular y la misma estructura modular.

## 1. Objetivo y alcance

- **Tareas:** ver, crear, editar y eliminar tareas; administrar **proyectos**, **estados** y **etiquetas**;
  traer los datos de Plane con un botón de sincronizar.
- **Kanban:** tableros con una columna por estado; mover tarjetas entre columnas y dentro de una columna
  (arrastrando y también con un menú); agregar y quitar tareas de un tablero.
- **Menú:** el sidebar pasa a admitir **grupos desplegables**. Habrá un grupo para Tareas (con sus
  subpáginas) y una entrada para Kanban.
- Todo **responsive** (móvil primero), con signals, zoneless y componentes compartidos, como el resto.

Fuera de alcance (v1): enviar los cambios de vuelta a Plane, permisos y usuarios, comentarios y archivos adjuntos
de una tarea, subtareas, tableros con límites de trabajo (WIP), tema oscuro.

## 2. Qué ofrece hoy el backend

Rutas verificadas en el código del servidor (el front las llama por `/api/...`):

| Recurso | Rutas | Datos |
|---|---|---|
| Proyectos | `GET /projects`, `POST /projects`, `POST /projects/sync` | `id, name, externalId, source, syncedAt, createdAt`. **No hay editar ni borrar** |
| Tareas | `GET /issues`, `GET /issues/:id`, `GET /issues/projects/:projectId`, `POST /issues`, `PATCH /issues/:id`, `DELETE /issues/:id`, `POST /issues/:id/state/:stateId`, `POST /issues/projects/:projectId/sync` | `id, name, description, priority, stateId, projectId, labelIds, startDate, dueDate, estimatedHours, isLocal, externalId, remoteSequence, localSequence, externalState` |
| Estados | `GET/POST /states`, `PATCH/DELETE /states/:id` | `id, name, color, position`. **Son globales**, no por proyecto |
| Etiquetas | `GET/POST /labels`, `PATCH/DELETE /labels/:id` | `id, name, color` |
| Tableros | `GET/POST /boards`, `GET/PATCH/DELETE /boards/:id` | `id, name, description, createdAt` |
| Tarjetas | `GET/POST /boards/:id/issues`, `DELETE /boards/:id/issues/:issueId`, `PATCH /boards/:id/issues/:issueId/move` | `id, boardId, issueId, position`. `move` recibe `{ stateId, position }` |
| Horas | `GET/POST /time-entries`, `GET /time-entries/issue/:id[/total-hours]`, `DELETE /time-entries/:id` | `issueId, hours, date` |

Consecuencias para el diseño:

- **Las columnas del kanban son los estados globales**, ordenados por `position`. Una tarea sin estado va a una
  columna "Sin estado".
- **Una tarjeta solo conoce `issueId` y `position`.** El front debe unir tres respuestas (tarjetas del tablero,
  tareas y estados) para armar las columnas.
- **Una tarea solo puede estar en un tablero** (la columna `issue_id` es única). Es una decisión a confirmar
  (ver sección 12).
- **Las tareas que vienen de Plane no se pueden borrar** (el backend lo rechaza); solo las locales.
- El sync con Plane **trae solo las tareas asignadas a ti**.

## 3. Prerrequisitos del backend (bloqueantes)

Hay cosas que el front no puede resolver solo. Van **antes** o junto con cada fase.

| # | Problema | Efecto en el front | Arreglo |
|---|---|---|---|
| B1 | **El kanban no tiene migración.** Las tablas `boards` y `board_issues` no existen en ninguna base de datos (tampoco en producción) | Todas las rutas de `/boards` fallan | Generar la migración (`npm run migration:generate`); saldría solo con esas dos tablas |
| B2 | **`POST /issues/:id/state/:stateId` siempre responde 404.** `IssuesService.setState` busca el estado con el repositorio de **tareas** (`issueRepository.findById(stateId)`) y ni siquiera tiene el de estados | No se puede cambiar el estado desde la lista ni desde el detalle | Inyectar el puerto de estados y validar contra él; agregar test |
| B3 | **`PATCH /issues/:id` solo edita nombre, descripción y proyecto.** Prioridad, fechas, horas estimadas, etiquetas y estado no se pueden editar por la API | El formulario de tarea quedaría mínimo | Ampliar `UpdateIssueDto` (y `CreateIssueDto` con `stateId`, ya presente en el servicio) con esos campos; validar en la entidad |
| B4 | **El flujo de mover tarjetas nunca se probó contra una base real** (lo dicen los pendientes en `docs/architecture/pendientes-hexagonal`) | Posibles errores al arrastrar | Tests de integración del `move` y de agregar a un tablero, después de B1 |
| B5 | *(Opcional)* No hay `PATCH`/`DELETE` de proyectos ni una forma de reordenar estados en bloque | La página de proyectos es de solo lectura y crear; reordenar estados exige varios `PATCH` | Agregar `PATCH/DELETE /projects/:id` y `POST /states/reorder` |
| B6 | *(Opcional)* La posición es un entero con saltos de 1000; tras muchos movimientos entre dos tarjetas puede no quedar espacio | Habría que renumerar la columna desde el front, con varias peticiones | Un endpoint `POST /boards/:id/reorder` que renumere en el servidor |

## 4. Menú: nombres y estructura

### El grupo desplegable

Propongo llamarlo **"Tareas"** y que contenga:

| Entrada | Ruta | Qué es |
|---|---|---|
| Todas las tareas | `/tasks` | La lista de tareas |
| Proyectos | `/tasks/projects` | Proyectos (locales y de Plane) |
| Estados | `/tasks/states` | Los estados / columnas del kanban |
| Etiquetas | `/tasks/labels` | Etiquetas con color |

Alternativas de nombre para el grupo, por si "Tareas" no te convence: **"Gestión"**, **"Planificación"** o
**"Trabajo"**. Mi razón para elegir "Tareas": es el nombre del módulo, así que el menú y las rutas coinciden. Para
no tener "Tareas → Tareas", la primera entrada se llama **"Todas las tareas"**.

### Kanban

Dos opciones:

- **A (recomendada): una sola entrada "Kanban"** (`/kanban`). La página tiene un selector de tablero arriba y un
  botón "Nuevo tablero". Es más simple y no hace falta cargar tableros en el menú.
- **B: un grupo desplegable "Kanban"** que lista los tableros como subentradas y "Nuevo tablero". Se ve más
  integrado, pero el menú pasa a depender de datos de la API y cambia solo.

### Orden y estado de cada grupo

Propongo: **Tareas · Kanban · Pull requests · Agentes de IA** (lo de trabajo diario primero). Hoy el orden es
Pull requests y Agentes; cambiarlo es una decisión tuya (sección 12).

### Cambios en el menú (`core/navigation` y `core/layout/sidebar`)

El registro actual (`NavItem { label, icon, path, order }`) se extiende para admitir grupos:

```ts
export interface NavLeaf { label: string; path: string; icon?: IconName }
export interface NavItem {
  label: string; icon: IconName; order: number;
  path?: string;          // entrada simple
  children?: NavLeaf[];   // grupo desplegable (no navega por sí mismo)
}
```

- Cada módulo sigue registrando su entrada con `provideNavItem`; el sidebar no conoce a los módulos.
- **Un grupo** es un `<button aria-expanded aria-controls>` con una flecha que gira, y una lista de subentradas
  indentadas. Teclado: Enter y Espacio abren y cierran.
- **Estado activo:** el grupo se resalta si alguna subentrada está activa, y **se abre solo** cuando la ruta
  actual cae dentro de él. Las subentradas usan `routerLinkActive` y `aria-current="page"`.
- **Recuerda si estaba abierto** (por visitante, en `localStorage`, tolerando que falle).
- Funciona igual en el drawer móvil; al elegir una subentrada, el drawer se cierra.
- Estilo: el de las entradas actuales (fondo gris suave en la activa); las subentradas, un nivel más tenues.

## 5. Estructura de carpetas

Siguiendo la convención de módulos directos bajo `src/app/` con su alias (como el backend):

```
src/app/
  tasks/                              ← módulo Tareas      alias @tasks/*
    index.ts                          ← API pública (la usa kanban)
    tasks.routes.ts, tasks.nav.ts
    models/                           issue.ts, project.ts, state.ts, label.ts
    data-access/                      issues|projects|states|labels  .api.ts / .store.ts
    pages/                            issue-list-page, issue-detail-page,
                                      project-list-page, state-list-page, label-list-page
    components/                       issue-table, issue-form-dialog, priority-badge,
                                      state-badge, label-tag, project-form-dialog,
                                      state-form-dialog, label-form-dialog
  kanban/                             ← módulo Kanban      alias @kanban/*
    index.ts, kanban.routes.ts, kanban.nav.ts
    models/                           board.ts, board-card.ts, board-column.ts
    data-access/                      boards.api.ts, boards.store.ts, board-view.store.ts
    domain/                           board-columns.ts, card-position.ts   (lógica pura)
    pages/                            board-page
    components/                       board-toolbar, board-column, board-card,
                                      board-form-dialog, add-issues-dialog, move-menu
  shared/ui/                          ← se agregan componentes (sección 6)
```

- Alias nuevos en `tsconfig.json`: `@tasks/*` y `@kanban/*`.
- **Regla de dependencias:** `kanban` usa tareas y estados **solo por `@tasks/index`** (el almacén de tareas, el de
  estados y sus modelos). ESLint se actualiza para hacerlo cumplir en ambos sentidos, igual que con `pr-review` y
  `ai-agents`.

## 6. Componentes compartidos nuevos (`shared/ui`)

| Componente | Para qué |
|---|---|
| **Menu** (acciones) | Menú desplegable de un botón: acciones de fila ("Editar", "Eliminar") y "Mover a…" en las tarjetas. Teclado, `Esc` y clic afuera |
| **ColorInput** | Color de estados y etiquetas: muestras predefinidas + `<input type="color">` |
| **Tag** | Etiqueta con punto de color (etiquetas de tarea, proyecto) |
| **DateInput** y **NumberInput** | Fechas (inicio, vencimiento) y horas, con el estilo de los demás controles |
| **Tabs** | Pestañas del detalle de tarea (Detalle · Horas) |
| **ListBox / multiselect** | Elegir varias etiquetas |

**Dependencia nueva: `@angular/cdk`**, usado por el kanban para **arrastrar y soltar** (`drag-drop`) y, si hace
falta, para el posicionamiento del menú (`overlay`) y la accesibilidad (`a11y`). Se carga solo en el chunk del
kanban.

## 7. Módulo Tareas

### Estados (`/tasks/states`)
- Lista ordenada por posición, cada fila con un punto del color, el nombre y acciones.
- Crear y editar en un diálogo (nombre + color). Borrar con confirmación.
- **Reordenar** con arrastre y también con botones "subir / bajar" (accesible y táctil). El orden es el de las
  columnas del kanban. Cada cambio hace `PATCH` de la posición (o el `reorder` en bloque, si existe B5).

### Etiquetas (`/tasks/labels`)
- Lista de etiquetas con su color; crear, editar y borrar en diálogo.

### Proyectos (`/tasks/projects`)
- Lista con nombre, origen (**Plane** o **local**) y última sincronización.
- **Nuevo proyecto** (local) en un diálogo y botón **"Sincronizar con Plane"**, que muestra cuántos se
  crearon y actualizaron.
- Sin editar ni borrar mientras no exista B5.

### Tareas (`/tasks` y `/tasks/issues/:id`)
- **Lista:** tabla desde 768 px y tarjetas por debajo, como la de PRs. Columnas: tarea (nombre y clave
  `Proyecto #N`), proyecto, estado (punto de color), prioridad, etiquetas, vencimiento, horas estimadas.
- **Filtros:** proyecto, estado, etiqueta, búsqueda por texto y origen (Plane / local). Todos del lado del
  cliente: la API devuelve todo y el volumen es personal.
- **Acciones de cabecera:** "Nueva tarea" y "Sincronizar con Plane" (por proyecto: `POST
  /issues/projects/:id/sync`).
- **Crear:** diálogo con nombre, proyecto, descripción y estado. **Editar:** diálogo o la página de detalle.
- **Detalle:** todos los campos, estado cambiable con un selector, etiquetas, fechas, horas estimadas y una
  descripción formateada. Las tareas de Plane muestran su origen y avisan de qué campos se pisan en el próximo
  sync (sección 12).
- **Borrar:** solo tareas locales; en las de Plane el botón se oculta o se deshabilita con su razón.
- **Prioridad** como insignia: `urgent` y `high` con tonos de alerta, `medium`, `low` y sin prioridad más tenues.

## 8. Módulo Kanban (`/kanban` y `/kanban/:boardId`)

### Cómo se arma el tablero
1. Pide las tarjetas (`GET /boards/:id/issues`), las tareas y los estados (que ya tiene el módulo Tareas).
2. Una función pura `buildColumns(cards, issues, states)` produce las **columnas**: una por estado, ordenadas por
   `position`, más "Sin estado" si hace falta. Dentro de cada columna, las tarjetas van por su `position`.
3. La tarjeta muestra: título, proyecto, prioridad, hasta 2 etiquetas (+N), vencimiento y horas estimadas. Al
   pulsar, se abre un diálogo con el detalle de la tarea.

### Pantalla
- **Barra superior:** selector de tablero, "Nuevo tablero", "Editar" y "Eliminar" del tablero actual, **"Agregar
  tareas"** y filtros (proyecto, etiqueta, búsqueda).
- **Agregar tareas:** diálogo con las tareas **que aún no están en ningún tablero**, con filtros y selección
  múltiple. Hace un `POST` por tarea. Quitar una tarjeta usa su menú.
- **Columnas:** encabezado con el punto de color, el nombre y el contador.

### Mover tarjetas
- **Arrastrar y soltar** (CDK) dentro de una columna y entre columnas.
- **"Mover a…"** en el menú de cada tarjeta, con la lista de columnas. Es la forma principal en móvil y la
  alternativa para teclado, porque arrastrar con el dedo choca con el desplazamiento de la pantalla.
- **Actualización optimista:** la tarjeta se mueve de inmediato; si el `PATCH` falla, vuelve a su lugar y sale
  un aviso con el mensaje del servidor.
- **Posición:** se calcula con una función pura `positionBetween(previous, next)`. Al final de una columna:
  `última + 1000`; entre dos tarjetas: el punto medio entero. Si no queda espacio (diferencia menor que 2), hay
  que renumerar la columna (B6).
- Al cambiar de columna, el `move` también cambia el **estado** de la tarea, así que las demás pantallas lo ven.

### Responsive
- **Escritorio:** columnas lado a lado de ~300 px, con desplazamiento horizontal si no caben.
- **Móvil:** cada columna ocupa casi todo el ancho y se avanza con desplazamiento horizontal con *snap*; un
  indicador muestra en qué columna estás. El arrastre se activa con pulsación larga; "Mover a…" siempre está.
- Los diálogos, a pantalla casi completa en móvil, como los demás.

## 9. Capa de datos

Mismo patrón que `pr-review`: un `*.api.ts` por recurso (`HttpClient`, sin estado) y un `*.store.ts` con signals.

- `IssuesStore`, `ProjectsStore`, `StatesStore`, `LabelsStore` (tareas): lista, `loading`, `error`, `computed`
  para filtros y para mapas por id (`stateById`, `labelById`, `projectById`), y métodos de acción con aviso si
  fallan. Los estados y etiquetas se cargan una vez y se comparten.
- `BoardsStore` (tableros) y `BoardViewStore` (a nivel de página): carga el tablero, calcula `columns` con
  `computed`, y aplica el movimiento optimista con vuelta atrás.
- **Una sola lista de tareas en memoria:** el kanban y la lista de tareas usan el mismo `IssuesStore`, así que
  un cambio en uno se ve en el otro sin volver a pedir datos.
- Errores del backend: el interceptor ya los convierte en mensajes legibles.

## 10. Fases

0. **Backend (B1–B4).** Migración del kanban, arreglo de `setState`, ampliar `UpdateIssueDto`/`CreateIssueDto`
   y tests de integración de tableros. Despliegue con la cola de PRs vacía (reiniciar interrumpe revisiones).
1. **Base del front.** Alias `@tasks`/`@kanban`, `@angular/cdk`, reglas de ESLint, **menú con grupos**
   (`NavItem` con hijos y sidebar), y los componentes compartidos nuevos con sus tests.
2. **Catálogos.** Estados, etiquetas y proyectos (páginas simples; los estados se necesitan para todo lo demás).
3. **Tareas.** Lista, filtros, crear, editar, detalle, estado, borrar y sincronizar con Plane.
4. **Kanban.** Tableros (crear, editar, borrar), vista de columnas de solo lectura, agregar y quitar tareas,
   mover con "Mover a…", luego arrastrar y soltar con actualización optimista, y el responsive.
5. **Horas (opcional).** Pestaña "Horas" en el detalle de la tarea: lista, alta, borrado y total frente a las
   horas estimadas (`/time-entries`).
6. **Cierre.** Estados vacíos, carga y error en todo, accesibilidad por teclado, capturas en móvil y escritorio,
   documentación y despliegue (la migración se aplica sola al arrancar el servidor).

## 11. Riesgos

1. **El kanban nunca corrió contra una base real** (B1, B4): lo más probable es que aparezcan errores del
   backend al empezar. Por eso la fase 0 viene primero y con tests de integración.
2. **Sin migración, producción no tiene las tablas.** El primer despliegue con el kanban debe incluirla.
3. **Posiciones enteras.** Con muchos movimientos puede agotarse el espacio entre dos tarjetas (B6).
4. **Arrastrar en pantallas táctiles** compite con el desplazamiento; por eso "Mover a…" es la vía principal en
   móvil.
5. **Una tarea en un solo tablero.** Si quieres reutilizarlas en varios, cambia el modelo del backend.
6. **Volumen.** Cargar todas las tareas de una vez sirve para uso personal; si crece mucho, habrá que paginar.
7. **Dependencia nueva (CDK).** Aumenta el tamaño del chunk del kanban, pero no el inicial.

## 12. Decisiones (respondidas)

1. **Grupo del menú:** «Tareas», con «Todas las tareas», «Proyectos», «Estados» y «Etiquetas».
2. **Kanban:** una entrada con selector de tablero; se pueden crear y ver varios tableros, y las columnas de
   cada uno son los estados.
3. **Orden del menú:** Tareas · Kanban · Pull requests · Agentes de IA.
4. **Una tarea en un solo tablero:** se mantiene.
5. **Horas:** incluidas. Una tarea puede tener varias entradas el mismo día.
6. **Plane:** el workbench no envía cambios de vuelta (se organiza en Plane después). Los proyectos y las
   tareas de Plane solo se actualizan con el sync.
7. **Proyectos:** los de Plane no se editan ni se borran; los locales sí. El orden de los estados se cambia en
   bloque.
8. **Sync:** un cron en el servidor cada hora (`TASKS_SYNC_CRON`), además del botón manual.

## 13. Criterios de aceptación

- El sidebar muestra el grupo **Tareas** (desplegable, con sus 4 subentradas) y **Kanban**; el grupo se abre solo
  cuando la ruta actual está dentro de él y recuerda si estaba abierto; funciona en el drawer móvil.
- Se pueden crear, editar, ordenar y borrar estados y etiquetas, y crear y sincronizar proyectos.
- Se pueden crear, filtrar, editar y cambiar de estado las tareas; las de Plane no se pueden borrar y el botón lo
  explica.
- En el kanban se crea un tablero, se agregan tareas, se mueven entre columnas y dentro de una columna
  (arrastrando y con "Mover a…") y el cambio de columna queda reflejado en el estado de la tarea.
- Si un movimiento falla, la tarjeta vuelve a su lugar y se avisa con el mensaje del servidor.
- Todo se ve y funciona en móvil (360 px) y escritorio, y se maneja con teclado.
- `ng build`, `ng test` y el lint pasan sin errores, y las reglas de ESLint impiden que `kanban` importe algo de
  `tasks` fuera de `@tasks/index`.

## 14. Estado de la implementación

Todo lo del plan está hecho, con estas diferencias respecto a lo planteado:

**Backend** (hexagonal: reglas en las entidades, casos de uso en `application`, HTTP y TypeORM en
`infrastructure`):

- **B1 migración del kanban:** `1791500000000-KanbanBoards` crea `boards` y `board_issues` (índice único por tarea).
- **B2 `setState`:** valida el estado contra el repositorio de estados; ya no responde siempre 404.
- **B3 edición de tareas:** `PATCH /issues/:id` y `POST /issues` aceptan estado, prioridad, fechas, horas
  estimadas y etiquetas. **Regla de dominio:** en una tarea de Plane el nombre, la descripción, la prioridad,
  las fechas y el proyecto se rechazan (400), porque el sync los sobrescribe; el estado, las etiquetas y las
  horas estimadas sí se editan.
- **B4 / `findByIds`:** el flujo de tableros se probó contra la base real y se corrigió un error que lo rompía
  (el repositorio de tareas no cargaba el proyecto en `findByIds`). Además las horas (`decimal`) llegaban como
  texto desde Postgres y ahora se convierten a número.
- **B5 proyectos:** `PATCH` y `DELETE` de `/projects/:id` solo para los locales (400 en los de Plane).
  `POST /states/reorder` deja los estados en el orden recibido. Borrar una etiqueta en uso ya no falla.
- **B6 movimiento de tarjetas (cambia respecto al plan):** en vez de que el front calcule una posición entera,
  `PATCH /boards/:id/issues/:issueId/move` recibe `{ stateId, index }` y el servidor coloca la tarjeta en ese
  lugar y **renumera la columna de destino** (de 1000 en 1000). Así el espacio entre tarjetas no se agota.
- **Tableros:** `GET /boards/assignments` (qué tareas ya están en un tablero) y, al borrar un tablero, sus
  tarjetas se liberan.
- **Sync (decisión 8):** `POST /sync` (proyectos y tareas) y un cron cada hora (`TASKS_SYNC_CRON`, vacío = cada
  hora en punto). Si dos syncs coinciden se comparte el que está en curso; si un proyecto falla, los demás
  siguen y el resultado lo informa.
- Los errores de reglas de dominio de tareas, tableros y horas ahora responden 400 (antes 500).

**Frontend:**

- Menú con grupos desplegables (`NavItem.children`), que se abre solo según la ruta y recuerda su estado.
- Nuevos en `shared/ui`: `Menu` (sobre `@angular/cdk/menu`), `Tag`, `ColorInput`, `ChipPicker`; `TextInput`
  acepta `date` y `number`.
- `@tasks/*` (tareas, proyectos, estados, etiquetas, detalle con horas) y `@kanban/*` (tableros, columnas por
  estado, arrastrar con `@angular/cdk/drag-drop`, «Mover a…», agregar y quitar tareas, movimiento optimista
  con vuelta atrás). ESLint impide que `kanban` use algo de `tasks` fuera de `@tasks/index`.
- No se hicieron (siguen fuera de alcance): filtros dentro del tablero, tema oscuro, subtareas.
