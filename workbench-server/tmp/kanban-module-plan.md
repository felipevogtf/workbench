# Plan: módulo Kanban (arquitectura hexagonal)

## 1. Resumen del dominio nuevo

Dos agregados nuevos, ambos dueños del bounded context `kanban`:

- **`Board`**: el tablero. CRUD simple, sin relación a `Project`. Las issues se agregan explícitamente, no se derivan de "todas las issues del proyecto X".
- **`BoardIssue`**: la membresía de una issue en un tablero + su posición dentro de la columna actual.

`BoardIssue` referencia `issueId` como valor plano (uuid), sin relación ORM cruzando a `tasks` — mismo patrón que `TimeEntry` con `time_entries`. El estado (columna) **no se duplica** en `BoardIssue`; la fuente de verdad de "en qué columna está" sigue siendo `Issue.stateId` en `tasks`. `BoardIssue` solo aporta lo que es exclusivamente de kanban: pertenencia a un tablero y orden dentro de la columna.

## 2. Dirección de dependencia

`KanbanModule` importa `TasksModule` (dirección única, sin ciclos). Kanban necesita de tasks:

- `ISSUE_REPOSITORY_PORT` — leer issues, cambiar su estado.
- `STATE_REPOSITORY_PORT` — validar el estado destino al mover una card, listar columnas.

`IssuesService.setState()` (en `tasks/application`) **no está exportado** por `TasksModule` — solo se exportan los ports (`ISSUE_REPOSITORY_PORT`, `PROJECT_REPOSITORY_PORT`, `STATE_REPOSITORY_PORT`, `LABEL_REPOSITORY_PORT`), no los services. Kanban va a orquestar el cambio de estado directamente con los ports: `issueRepo.findById(issueId)` → `issue.setState(stateId)` (método de dominio que ya existe en `Issue`) → `issueRepo.save(issue)`.

Nota: `IssuesService.setState` en tasks tiene hoy un bug — valida el estado contra `issueRepository.findById(stateId)` en vez de un state repo. No te afecta porque en kanban vas a validar el estado con `STATE_REPOSITORY_PORT` directamente, correctamente.

## 3. Cambio necesario en `tasks`

`IssueRepositoryPort` no tiene un método de batch-fetch. Agregar:

```ts
findByIds(ids: string[]): Promise<Issue[]>;
```

Se usa para traer de una sola vez todas las issues de un tablero al abrirlo (evita N+1). Implementarlo en `TypeOrmIssueRepository` con un `findBy({ id: In(ids) })` o `whereInIds`.

## 4. Filtrado por nombre/código

No se toca `tasks`. Kanban trae todas las issues del board vía `findByIds`, y filtra **en memoria** en `board-issues.service.ts` por `name` (substring, case-insensitive) o por "código" (`sequenceNumber`/`localId` — no hay un campo `code` único en `Issue`, así que hay que decidir cuál de los dos representa el código visible; probablemente `localId` para issues locales y `sequenceNumber` para las sincronizadas). Un tablero tiene decenas/cientos de cards, no amerita meter búsqueda en el port de tasks.

## 5. Decisiones recomendadas (para no bloquearte, pero son tuyas de confirmar)

| Decisión | Recomendación | Alternativa |
|---|---|---|
| Agregar issue que ya está en otro board | Rechazar con 409 Conflict. Mover entre boards es una acción explícita aparte (`moveToBoard`), no un side-effect de `addIssueToBoard`. | Reasignar automáticamente (silencioso) |
| Issue sin `stateId` al agregarla al board | No forzar estado. Usar el `stateId` actual de la issue (puede ser `null`) y mostrar una columna "Sin estado" en la vista. | Exigir `stateId` obligatorio en el body de `addIssueToBoard` |
| Borrar un board | Cascada **solo dentro de kanban** (`board_issues` por `board_id`). Las issues en `tasks` no se tocan. | — |
| Estrategia de posición | Enteros con gaps de 1000 (ver sección 8). | Float/decimal, o reordenar todo en cada move |

## 6. Estructura de carpetas

```
src/kanban/
  domain/
    entities/
      board.entity.ts
      board.props.ts
      board-issue.entity.ts
      board-issue.props.ts
    ports/
      board-repository.port.ts
      board-issue-repository.port.ts
  application/
    boards.service.ts        // CRUD de boards
    board-issues.service.ts  // agregar/quitar/mover/listar+filtrar issues del board
  infrastructure/
    persistence/
      board.orm-entity.ts
      board-issue.orm-entity.ts
    repositories/
      typeorm-board.repository.ts
      typeorm-board-issue.repository.ts
  dto/
    create-board.dto.ts
    update-board.dto.ts
    board-response.dto.ts
    add-issue-to-board.dto.ts
    move-issue.dto.ts
    board-issue-response.dto.ts
    board-view-response.dto.ts
  boards.controller.ts
  kanban.module.ts
```

## 7. Domain layer — detalle

### `board.props.ts`
```ts
export interface BoardProps {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}
```

### `board.entity.ts`
- `static create({ name, description }): Board` — genera uuid, `createdAt = new Date()`.
- `static reconstruct(props: BoardProps): Board`.
- Invariante: `name` no vacío (mismo criterio que `Issue`/`Project` en tasks — validar en el constructor/factory).
- `rename(name: string): void`
- `updateDescription(description: string | null): void`
- Getters: `id`, `name`, `description`, `createdAt`.

### `board-issue.props.ts`
```ts
export interface BoardIssueProps {
  id: string;
  boardId: string;
  issueId: string;
  position: number;
  createdAt: Date;
}
```

### `board-issue.entity.ts`
- `static create({ boardId, issueId, position }): BoardIssue`.
- `static reconstruct(props: BoardIssueProps): BoardIssue`.
- `reposition(position: number): void` — cambia la posición (se usa en el move).
- Getters.

No hay validación de `stateId` acá porque `BoardIssue` no lo conoce — vive en `tasks`.

## 8. Ports — firmas completas

### `board-repository.port.ts`
```ts
export interface BoardRepositoryPort {
  findById(id: string): Promise<Board | null>;
  findAll(): Promise<Board[]>;
  save(board: Board): Promise<Board>;
  delete(id: string): Promise<void>;
}
export const BOARD_REPOSITORY_PORT = Symbol('BOARD_REPOSITORY_PORT');
```

### `board-issue-repository.port.ts`
```ts
export interface BoardIssueRepositoryPort {
  findById(id: string): Promise<BoardIssue | null>;
  findByBoardId(boardId: string): Promise<BoardIssue[]>;
  findByIssueId(issueId: string): Promise<BoardIssue | null>; // para chequear "ya está en otro board"
  maxPositionInColumn(boardId: string, issueIds: string[]): Promise<number>; // ver sección de posiciones
  save(boardIssue: BoardIssue): Promise<BoardIssue>;
  delete(id: string): Promise<void>;
  deleteByBoardId(boardId: string): Promise<void>; // si no confiás 100% en el ON DELETE CASCADE de la FK
}
export const BOARD_ISSUE_REPOSITORY_PORT = Symbol('BOARD_ISSUE_REPOSITORY_PORT');
```

`maxPositionInColumn` es un poco raro porque "columna" no es un campo de `BoardIssue` — se resuelve en la capa de aplicación: primero preguntás a `tasks` qué issues están en el estado destino, después le pedís a este método la posición máxima entre esos `issueIds`. Alternativa más simple: no tener este método en el port y calcular la posición en memoria dentro del service, ya que de todas formas vas a traer todos los `BoardIssue` del board para armar la vista.

## 9. Application layer — casos de uso detallados

### `boards.service.ts`
CRUD puro, no toca `tasks` para nada:
- `createBoard({ name, description })`
- `updateBoard(id, { name?, description? })` — 404 si no existe
- `deleteBoard(id)` — 404 si no existe; borra en cascada los `board_issues` asociados
- `getBoard(id)`
- `listBoards()`

### `board-issues.service.ts` (depende de `ISSUE_REPOSITORY_PORT` y `STATE_REPOSITORY_PORT`)

**`addIssueToBoard(boardId, issueId)`**
1. Validar que el board existe (`BOARD_REPOSITORY_PORT`).
2. Validar que la issue existe (`ISSUE_REPOSITORY_PORT`).
3. Validar que la issue no esté ya en otro board (`BOARD_ISSUE_REPOSITORY_PORT.findByIssueId`) → si existe, 409 Conflict.
4. Calcular `position` inicial: última posición de la columna correspondiente al `stateId` actual de la issue, + 1000 (o 1000 si la columna está vacía).
5. Crear y guardar `BoardIssue`.

**`removeIssueFromBoard(boardId, issueId)`**
1. Buscar el `BoardIssue` por `boardId` + `issueId` (o por `issueId` solo, ya que es único). 404 si no existe.
2. Borrar.

**`moveIssue(boardId, issueId, { stateId, position })`**
1. Buscar el `BoardIssue` (404 si no existe o no pertenece a ese board).
2. Si `stateId` viene y es distinto al actual: validar que el estado existe (`STATE_REPOSITORY_PORT`), traer la `Issue` (`ISSUE_REPOSITORY_PORT`), `issue.setState(stateId)`, guardar.
3. Actualizar `position` en el `BoardIssue` con la estrategia de gaps (sección 10).
4. Guardar `BoardIssue`.

Nota: pasos 2 y 4 tocan dos agregados distintos (`Issue` en tasks, `BoardIssue` en kanban) que viven en la misma base de datos física pero son conceptualmente independientes — no hay una transacción de dominio unificada a menos que uses una transacción de DB explícita envolviendo ambos `save`. Si te importa la atomicidad (que no quede una issue con estado nuevo pero posición vieja si algo falla a mitad de camino), envolvé el método en una transacción de TypeORM (`dataSource.transaction(...)`) a nivel del repositorio o del service.

**`getBoardView(boardId, { search }?)`**
1. Traer todos los `BoardIssue` del board.
2. `findByIds` a `tasks` con esos `issueIds`.
3. Si `search`: filtrar por `name` o código (substring, case-insensitive) sobre las issues ya traídas.
4. Traer todos los `State` (`STATE_REPOSITORY_PORT.findAll()`), ordenados por `position` (el `position` de `State` es el orden de las columnas, no confundir con el `position` de `BoardIssue` que es el orden de las cards dentro de una columna).
5. Agrupar las issues filtradas por `stateId` (incluyendo un grupo `null` → "Sin estado"), y dentro de cada grupo ordenar por el `position` del `BoardIssue` correspondiente.
6. Devolver la estructura agrupada (ver sección 11 para el shape de respuesta).

## 10. Estrategia de posiciones (gaps)

- Al insertar al final de una columna: `position = max(posiciones de esa columna) + 1000`. Columna vacía → `1000`.
- Al insertar entre dos cards (drag & drop a una posición específica): `position = (posiciónAnterior + posiciónSiguiente) / 2`.
- Si el gap entre dos posiciones consecutivas es `<= 1` (ya no hay espacio para el punto medio), hace falta un **rebalanceo**: renumerar todas las cards de esa columna en pasos de 1000 (`1000, 2000, 3000...`) antes de insertar. Esto es infrecuente si arrancás con gaps grandes, pero conviene tenerlo previsto desde el diseño del método `moveIssue`, no como parche después.
- El `position` es un entero simple (`int`), no hace falta decimal si vas con la estrategia de gaps.

## 11. Infraestructura

### `board.orm-entity.ts`
```
Entity('boards')
- id: uuid (PK)
- name: varchar
- description: text | null
- created_at: timestamp (CreateDateColumn)
```

### `board-issue.orm-entity.ts`
```
Entity('board_issues')
- id: uuid (PK)
- board_id: uuid (FK normal a boards.id, ManyToOne — mismo contexto, relación ORM está bien acá)
- issue_id: uuid (columna plana, SIN relación ORM — mismo patrón que time_entries)
- position: int
- created_at: timestamp
```

Constraints a nivel DB (agregar a mano en la migración, como con `time_entries`):
- `UNIQUE (issue_id)` — refuerza la regla "1 issue vive en 1 board" a nivel de datos, no solo de aplicación.
- `FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE` — si se borra una issue en tasks, se limpia sola su membresía en el board.
- Índice en `board_id` (o compuesto `board_id, position`) para las queries de listado ordenado.

### Repositorios
`TypeOrmBoardRepository` y `TypeOrmBoardIssueRepository` — simples, mismo patrón que `TypeOrmTimeEntryRepository`. Nada de `relations` cruzando a tasks.

## 12. DTOs

- `CreateBoardDto`: `{ name: string; description?: string }`
- `UpdateBoardDto`: `PartialType(CreateBoardDto)`
- `BoardResponseDto`: `{ id, name, description, createdAt }`
- `AddIssueToBoardDto`: `{ issueId: string }`
- `MoveIssueDto`: `{ stateId?: string; position: number }`
- `BoardIssueResponseDto`: `{ boardIssueId, issueId, name, code, stateId, position }` (mezcla datos de `BoardIssue` + datos mínimos de `Issue`, armado en el controller/service, no en el dominio)
- `BoardViewResponseDto`:
```ts
{
  boardId: string;
  columns: Array<{
    stateId: string | null;
    stateName: string | null;
    cards: BoardIssueResponseDto[];
  }>;
}
```

## 13. Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/boards` | crear tablero |
| GET | `/boards` | listar tableros |
| GET | `/boards/:id` | detalle del tablero (sin issues) |
| PATCH | `/boards/:id` | editar name/description |
| DELETE | `/boards/:id` | eliminar tablero |
| GET | `/boards/:id/issues?search=` | vista kanban agrupada por estado, filtrable |
| POST | `/boards/:id/issues` | agregar issue existente al tablero |
| DELETE | `/boards/:id/issues/:issueId` | sacar issue del tablero |
| PATCH | `/boards/:id/issues/:issueId/move` | mover: cambiar estado y/o posición |

## 14. Orden sugerido de implementación

1. `findByIds` en `IssueRepositoryPort` + `TypeOrmIssueRepository` (tasks) — chico, aislado, fácil de probar solo.
2. Domain de kanban: `Board`, `BoardIssue` + sus ports (sin infra todavía, solo interfaces y entities puros).
3. `boards.service.ts` + infra de `Board` (`BoardOrmEntity`, `TypeOrmBoardRepository`) — CRUD aislado, sin tocar tasks, probalo solo.
4. `board-issues.service.ts` + infra de `BoardIssue` — acá ya conectás con tasks vía los ports (`addIssueToBoard`, `removeIssueFromBoard` primero, sin `moveIssue` todavía).
5. `moveIssue` con la estrategia de posiciones — es la parte más delicada, dejala para cuando el resto ya esté probado.
6. `getBoardView` con agrupamiento y filtro.
7. DTOs + controller + `kanban.module.ts` (import de `TasksModule`).
8. Migración: `boards` + `board_issues`, con los constraints manuales (UNIQUE, FK a issues). Recordá que sigue pendiente también la de `time_entries` — podés generarlas en el mismo archivo o por separado.
