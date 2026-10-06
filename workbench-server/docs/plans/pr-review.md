# Plan: revisión automática de Pull Requests con Claude

Estado: **propuesta, sin implementar**. Origen: el prototipo `C:\Users\felip\pr-reviewer` (script de
Python, solo Bitbucket, estado en `state.json`). Este plan lo migra al `workbench-server` siguiendo
su arquitectura hexagonal.

## 1. Objetivo y alcance

El sistema trae cada cierto tiempo (por defecto 30 min) las Pull Requests donde el usuario es
**reviewer**, las guarda sin duplicarlas, las revisa con Claude, guarda la revisión como `.md` y la
publica como comentario en la PR. Soporta **Bitbucket y GitHub**.

Reglas acordadas:

- Solo backend por ahora. API sin autenticación, solo para uso local (no exponer el puerto fuera de
  `localhost`: `re-review` ejecuta Claude con la cuenta y los tokens del usuario).
- Solo PRs donde el usuario es reviewer.
- Una PR nueva se revisa sola. Una PR ya revisada **no se vuelve a revisar sola**: si llega un commit
  nuevo queda marcada como desactualizada (`stale`) y la re-revisión es **manual** por API.
- Las revisiones pasan por una **cola**: una PR nueva o una re-revisión manual queda en `pending`
  (en cola) y pasa a `reviewing` (en curso) cuando le toca. El número de revisiones simultáneas es
  configurable (`REVIEW_CONCURRENCY`, por defecto 1). Ver la sección 4, "Cola de revisión".
- El agente (prompt) y el modelo que revisan son configurables.
- El `.md` se guarda en disco local y se sirve por un endpoint para consumirlo desde una app.

Fuera de alcance (v1): frontend, Slack, asignar un agente por repositorio, cola persistente
(BullMQ/Redis), autenticación de la API.

## 2. Dos módulos

La configuración de la IA vive en un módulo propio, separado de las PRs.

| Módulo | Responsabilidad | Sabe de PRs |
|---|---|---|
| `ai-agents` | Definir agentes (prompt, modelo, herramientas) y **ejecutarlos** con Claude | No |
| `pr-review` | Traer PRs, guardarlas, orquestar la revisión, comentar, servir el `.md` | Sí |

Por qué separarlos:

- Un agente es "prompt + modelo + herramientas permitidas". Nada de eso es específico de PRs.
- Lo que sí es de PRs es **construir el contexto** (título, ramas, descripción, cómo ver el diff).
  Eso se queda en `pr-review`; `ai-agents` solo recibe un prompt y un directorio de trabajo.
- Es la misma relación que `kanban` → `tasks`: el consumidor define su propio puerto
  (`AgentsGatewayPort`) y un único adaptador conoce al módulo vecino. Ver
  [pendientes-hexagonal/01](../architecture/pendientes-hexagonal/01-kanban-acoplado-a-tasks.md).

```
pr-review ──(AgentsGatewayPort)──► AgentsGatewayAdapter ──► AgentsService (ai-agents)
                                                                  │
                                                         AgentRunnerPort
                                                                  │
                                                    ClaudeCliAgentRunnerAdapter
```

## 3. Módulo `ai-agents`

```
src/ai-agents/
  domain/
    entities/   agent.entity.ts, agent.props.ts
    ports/      agent-repository.port.ts   (AGENT_REPOSITORY_PORT)
                agent-runner.port.ts       (AGENT_RUNNER_PORT)
  application/  agents.service.ts
  dto/          create-agent.dto.ts, update-agent.dto.ts, agent-response.dto.ts
  infrastructure/
    http/          agents.controller.ts
    persistence/   agent.orm-entity.ts
    repositories/  typeorm-agent.repository.ts
    adapters/      claude-cli-agent-runner.adapter.ts
  ai-agents.module.ts            (exporta AgentsService)
```

### Entidad `Agent`

Constructor privado, `create()` y `reconstruct()`, igual que el resto del proyecto.

| Campo | Notas |
|---|---|
| `id` | uuid |
| `name` | único, no vacío |
| `systemPrompt` | instrucciones del agente (el contenido de `review-prompt.md` del prototipo) |
| `model` | id del modelo, ej. `claude-sonnet-5-5`. Texto libre, no vacío |
| `allowedTools` | lista de herramientas que el agente puede usar |
| `isDefault` | solo uno puede serlo |
| `createdAt`, `updatedAt` | |

Reglas de dominio (dentro de la entidad, no en el servicio):

- `name`, `systemPrompt` y `model` no pueden venir vacíos.
- **Las herramientas se validan contra una lista permitida de solo lectura** (`Read`, `Grep`,
  `Glob`, `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git show:*)`). Se rechaza `Write`, `Edit` o
  `Bash` sin restricción. Motivo: el agente corre sobre código y descripciones de PRs que pueden
  contener instrucciones maliciosas (prompt injection); no debe poder escribir ni ejecutar nada.
- `markAsDefault()` / `unmarkAsDefault()`.

### Puertos

```ts
// agent-repository.port.ts
export interface AgentRepositoryPort {
  findById(id: string): Promise<Agent | null>;
  findByName(name: string): Promise<Agent | null>;
  findDefault(): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  save(agent: Agent): Promise<Agent>;
  delete(id: string): Promise<void>;
  clearDefault(): Promise<void>;          // para cambiar de agente por defecto
}
export const AGENT_REPOSITORY_PORT = Symbol('AGENT_REPOSITORY_PORT');

// agent-runner.port.ts
export interface AgentRunInput {
  agent: Agent;
  prompt: string;       // contexto de la tarea, lo arma quien llama
  workdir: string;      // directorio donde el agente puede leer
  model?: string;       // override puntual del modelo del agente
}
export interface AgentRunnerPort {
  run(input: AgentRunInput): Promise<string>;   // texto/markdown de respuesta
}
export const AGENT_RUNNER_PORT = Symbol('AGENT_RUNNER_PORT');
```

### `AgentsService`

- CRUD: `create`, `update`, `findAll`, `findById`, `delete`.
- `setDefault(id)`: `clearDefault()` y luego `markAsDefault()` en el elegido.
- `getDefault()`: lanza `NotFoundException` si no hay ninguno.
- `run({ agentId?, model?, prompt, workdir })`: resuelve el agente (el pedido o el por defecto) y
  delega en `AgentRunnerPort`.
- No se puede borrar el agente por defecto (devuelve error pidiendo marcar otro antes).

### `ClaudeCliAgentRunnerAdapter`

Ejecuta el CLI de Claude, igual que el prototipo, que ya funciona y reutiliza el login del usuario:

- `child_process.spawn` con `claude -p --model <model> --allowedTools <lista>`.
- El `systemPrompt` del agente y el `prompt` de la tarea se envían por stdin (como hace el
  prototipo). Alternativa a evaluar en la fase 4: `--append-system-prompt`; **verificar los flags con
  `claude --help`** antes de decidir.
- `cwd = workdir`.
- **Timeout** configurable (`AGENT_TIMEOUT_MS`, por defecto 10 min); si se pasa, se mata el proceso y
  se lanza error.
- Si el proceso termina con código distinto de 0, lanza error con el stderr (sin tokens).
- La alternativa sería el Agent SDK; se descarta en la v1 porque cambia el control de herramientas y
  costos, y el CLI ya está probado.

### API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/agents` | Lista de agentes |
| GET | `/agents/:id` | Detalle |
| POST | `/agents` | Crea un agente |
| PATCH | `/agents/:id` | Edita nombre, prompt, modelo o herramientas |
| POST | `/agents/:id/default` | Lo marca como agente por defecto |
| DELETE | `/agents/:id` | Borra (no el por defecto) |

Una migración **siembra** el agente inicial `default-reviewer` con el prompt de `review-prompt.md` y
`isDefault = true`, para que el sistema funcione sin configurar nada.

## 4. Módulo `pr-review`

```
src/pr-review/
  domain/
    entities/   pull-request.entity.ts + .props.ts
                review.entity.ts + .props.ts
    ports/      pull-request-repository.port.ts
                review-repository.port.ts
                pull-request-source.port.ts     (+ RemotePullRequestData)
                pull-request-comment.port.ts
                repository-checkout.port.ts
                review-storage.port.ts
                agents-gateway.port.ts          (hacia ai-agents)
  application/  pull-requests.service.ts        → sync, lectura
                reviews.service.ts              → revisar, re-revisar, reintentar comentario, leer .md
  dto/          pull-request-response.dto.ts, review-response.dto.ts, re-review.dto.ts
  infrastructure/
    http/          pull-requests.controller.ts
    persistence/   pull-request.orm-entity.ts, review.orm-entity.ts
    repositories/  typeorm-pull-request.repository.ts, typeorm-review.repository.ts
    clients/       bitbucket-api.client.ts + .types.ts, github-api.client.ts + .types.ts
    adapters/      bitbucket.adapter.ts, github.adapter.ts,
                   git-cli-checkout.adapter.ts, local-file-review-storage.adapter.ts,
                   agents-gateway.adapter.ts
    scheduling/    pr-review.scheduler.ts       (adaptador de entrada, solo llama a servicios)
  pr-review.module.ts
```

### Modelo de datos

**`pull_requests`** (una fila por PR; **UNIQUE (provider, repo, external_id)** garantiza que no se
repitan)

| Columna | Notas |
|---|---|
| `id` | uuid |
| `provider` | `bitbucket` \| `github` |
| `repo` | `workspace/slug` u `owner/repo` |
| `external_id` | id de la PR en el provider |
| `url`, `title`, `author` | |
| `source_branch`, `dest_branch` | |
| `head_commit` | último commit visto en la PR |
| `state` | `open` \| `closed` |
| `status` | `pending` (en cola) \| `reviewing` (en curso) \| `reviewed` \| `failed` |
| `queued_at` | cuándo entró a la cola; define el orden (FIFO). Se actualiza en cada re-revisión |
| `requested_agent_id`, `requested_model` | override pedido en un `re-review`, se conserva mientras la PR espera en cola; se limpian al empezar |
| `last_reviewed_at` | |
| `review_doc_url` | ruta del `.md` de la última revisión (copia para listar rápido) |
| `reviewed_commit` | commit que se revisó |
| `last_error` | |
| `created_at`, `updated_at` | |

`stale` **no es una columna**. Se deriva en la entidad:
`reviewedCommit !== null && headCommit !== reviewedCommit`. Así no hay un campo que pueda quedar
inconsistente.

**`reviews`** (historial; una fila por ejecución)

| Columna | Notas |
|---|---|
| `id`, `pull_request_id` | |
| `commit` | commit revisado |
| `agent_id`, `agent_name`, `model` | qué agente y qué modelo se usaron. `agent_id` es un `uuid` simple, **sin FK** hacia `ai-agents` (módulos independientes); `agent_name` se copia por si el agente se edita o borra después |
| `doc_path` | ruta del `.md` |
| `status` | `ok` \| `failed` |
| `error` | |
| `comment_status` | `pending` \| `posted` \| `failed` |
| `comment_url`, `comment_error` | |
| `created_at` | |

Las columnas son `snake_case` en las `*.orm-entity.ts`, que el glob de `database.config.ts` toma
solo. La migración se genera con `npm run migration:generate`, no a mano.

### Entidades de dominio

**`PullRequest`**

- `createFromRemote(data)`: nace `pending` (entra a la cola), `state = open`.
- `syncFromRemote(data)`: actualiza título, ramas y `headCommit`. **No toca `status`.**
- `enqueue({ agentId?, model? })`: re-revisión manual. Pasa a `pending`, actualiza `queuedAt` y guarda
  el override. Si ya está `pending` solo actualiza el override (no duplica ni pierde su lugar); si
  está `reviewing` lanza error (se responde 409).
- `markReviewing()`: solo válido desde `pending`; lanza error en cualquier otro estado.
- `markReviewed({ commit, docPath })`, `markFailed(error)`, `markClosed()`.
- `get isStale()`.

**`Review`**: `create(...)`, `markCommentPosted(url)`, `markCommentFailed(error)`.

### Puertos

```ts
// pull-request-source.port.ts
export interface RemotePullRequestData {
  provider: GitProvider; repo: string; externalId: string; url: string;
  title: string; author: string; sourceBranch: string; destBranch: string; headCommit: string;
}
export interface PullRequestSourcePort {
  readonly provider: GitProvider;
  getReviewRequestedPullRequests(): Promise<RemotePullRequestData[]>;
}

// pull-request-comment.port.ts
export interface PullRequestCommentPort {
  readonly provider: GitProvider;
  postComment(repo: string, externalId: string, markdown: string): Promise<string>; // url
}

// repository-checkout.port.ts
export interface RepositoryCheckoutPort {
  checkout(pr: PullRequest): Promise<{ path: string; dispose(): Promise<void> }>;
}

// review-storage.port.ts
export interface ReviewStoragePort {
  save(pr: PullRequest, commit: string, markdown: string): Promise<string>; // docPath
  read(docPath: string): Promise<string>;
}

// agents-gateway.port.ts   (contrato propio de pr-review hacia ai-agents)
export interface AgentsGatewayPort {
  runReview(input: {
    agentId?: string; model?: string; prompt: string; workdir: string;
  }): Promise<{ markdown: string; agentId: string; agentName: string; model: string }>;
}
```

Los puertos de fuente y de comentario se parten por responsabilidad, como `project-source.port` e
`issue-source.port` en `tasks`, y cada adaptador de provider implementa ambos (`useExisting`).
Los tipos `Remote*Data` usan vocabulario del dominio: nada de `snake_case` de Bitbucket o GitHub.

`AgentsGatewayAdapter` es el **único** archivo de `pr-review` que importa algo de `ai-agents`
(inyecta `AgentsService`). Devuelve el nombre y modelo realmente usados para que la `Review` los
guarde.

### Cola de revisión

La cola **es la base de datos**: no hay Redis ni una estructura aparte en memoria.

- `pending` = en cola. `reviewing` = en curso. El orden de salida es `queued_at` ascendente (FIFO).
- Entran a la cola: las PRs nuevas del `sync()` y las re-revisiones manuales (`enqueue`).
- El puerto `PullRequestRepositoryPort` incluye `claimNextPending(): Promise<PullRequest | null>`.
  Toma la `pending` más antigua y la pasa a `reviewing` **en una sola operación atómica**
  (`UPDATE … WHERE id = (SELECT id … WHERE status = 'pending' ORDER BY queued_at LIMIT 1
  FOR UPDATE SKIP LOCKED) RETURNING *`). Así dos workers nunca toman la misma PR.
- `ReviewsService.kick()` despierta a los workers: mientras haya menos de `REVIEW_CONCURRENCY`
  workers activos (contador en memoria) y existan `pending`, lanza uno más. Cada worker repite
  `claimNextPending()` → `executeReview()` hasta que la cola queda vacía. Un fallo en una revisión
  la marca `failed` y el worker sigue con la siguiente.
- Quien encola (cron, `POST /sync`, `POST /re-review`) **nunca revisa directamente**: guarda la PR
  en `pending` y llama a `kick()`. Por eso un re-review manual, un sync y el cron no pueden pasarse
  por encima del límite.
- Ejemplo con `REVIEW_CONCURRENCY=1`: llegan las PRs A y B → ambas `pending`; el worker toma A
  (`reviewing`) y B espera. Mientras A se revisa, haces re-review de C → `pending` detrás de B. Al
  terminar A sigue B y luego C.
- Si el servidor se reinicia: las `pending` siguen en cola; las que estaban `reviewing` pasan a
  `failed` al arrancar (se reencolan a mano con `re-review`).
- El límite es **por instancia** del servidor. La atomicidad de `claimNextPending` evita duplicados
  aunque hubiera dos instancias, pero cada una respetaría su propio `REVIEW_CONCURRENCY`. Para uso
  local con una instancia no importa.

### Dos providers

Hasta ahora cada puerto del proyecto tenía una sola implementación; aquí hay dos. Se registran como
arreglo con un factory provider (`PULL_REQUEST_SOURCE_PORTS`, `PULL_REQUEST_COMMENT_PORTS`) y el
servicio elige el adecuado por `provider`. Agregar un tercer provider es sumar un adaptador a la
factory.

- **Bitbucket**: filtro `state="OPEN" AND reviewers.uuid="<yo>"` sobre los repos configurados (como el
  prototipo). Auth básica con email + token.
- **GitHub**: búsqueda `is:pr is:open review-requested:@me`.

### Servicios

**`PullRequestsService`**

- `sync()`:
  1. Recorre los source ports y hace upsert por `findByExternalKey(provider, repo, externalId)`.
     Las nuevas se crean `pending`; las existentes pasan por `syncFromRemote` (si cambió el commit
     queda `stale`, sin revisarse sola).
  2. Las que estaban `open` y ya no vienen en el listado pasan a `closed` (se conservan con su
     historial).
  3. Devuelve `{ created, updated, closed }`.
- `findAll(filters)`, `findById(id)`.

**`ReviewsService`**

- `kick()` y el worker que describe "Cola de revisión": `claimNextPending()` → `executeReview()` en
  bucle, con un máximo de `REVIEW_CONCURRENCY` workers a la vez.
- `reReview(prId, { agentId?, model? })`: `pr.enqueue(...)`, guarda y llama a `kick()`. **No espera la
  revisión**; devuelve la PR en `pending`.
- `retryComment(reviewId)`: reintenta solo el comentario, sin volver a pagar la revisión.
- `readReview(prId)` / `readReviewById(reviewId)`: devuelve el `.md`.
- Método privado común `executeReview(pr)`, que recibe una PR ya reclamada (`reviewing`) y lee el
  override de `requestedAgentId` / `requestedModel`:
  1. (la PR ya viene en `reviewing` desde `claimNextPending`).
  2. `checkout` → arma el prompt de contexto (título, autor, ramas, descripción y
     `git diff origin/<dest>...origin/<source>`).
  3. `agentsGateway.runReview(...)`.
  4. `storage.save(...)`.
  5. Crear la `Review` y guardarla (la revisión **queda registrada** aunque luego falle el
     comentario).
  6. `postComment(...)`. Si falla: `review.markCommentFailed(...)`, y la PR igual se marca
     `reviewed` (se puede reintentar con `retryComment`).
  7. `pr.markReviewed(...)` y guardar.
  8. Si algo antes del paso 5 falla: `pr.markFailed(error)`.
  9. `dispose()` del checkout en un `finally`.

Resolución de agente y modelo: override de la petición → agente por defecto. El modelo del override
tiene prioridad sobre el del agente.

### Scheduler

`@Cron` configurable (`PR_SYNC_CRON`, por defecto cada 30 min). Hace `sync()` (que deja las PRs
nuevas en `pending`) y luego `kick()`. Como el scheduler solo encola, no necesita bandera
anti-solape: si una revisión dura más que el intervalo, el siguiente sync simplemente encola lo nuevo
detrás de lo que ya hay. Al arrancar el servidor, las PRs que quedaron en `reviewing` por un corte
pasan a `failed`, y se llama a `kick()` para retomar las `pending`.

### API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/pull-requests?status=&provider=&stale=` | Lista |
| GET | `/pull-requests/:id` | Detalle con historial de revisiones |
| GET | `/pull-requests/:id/review` | Devuelve el `.md` de la última revisión |
| GET | `/pull-requests/:id/reviews/:reviewId` | Devuelve el `.md` de una revisión concreta |
| POST | `/pull-requests/sync` | Fuerza un sync: trae las PRs y encola las nuevas |
| POST | `/pull-requests/:id/re-review` | Body opcional `{ agentId?, model? }`. Encola la PR y responde `202` con la PR en `pending`; 409 si ya está `reviewing`. El resultado se consulta con `GET` hasta que pase a `reviewed` o `failed` |
| GET | `/pull-requests/queue` | Estado de la cola: PRs `reviewing` y `pending` en orden, y el valor de `REVIEW_CONCURRENCY` |
| POST | `/pull-requests/:id/retry-comment` | Reintenta solo el comentario |

Los controllers solo llaman a servicios de aplicación y devuelven DTOs planos con un `toDto()`
privado, como `TimeEntriesController`. Ninguno importa de `domain/ports`.

## 5. Configuración

`env.validation.ts` hoy exige todas las variables. Para dos providers no sirve, porque obligaría a
configurar GitHub aunque solo se use Bitbucket. Se agrega `REVIEWS_DIR` a las obligatorias y los
tokens se validan **por provider**: si falta el token de uno, su adaptador se desactiva y se loguea
un aviso.

| Variable | Uso |
|---|---|
| `REVIEWS_DIR` | carpeta donde se guardan los `.md` (obligatoria) |
| `BITBUCKET_EMAIL`, `BITBUCKET_TOKEN`, `BITBUCKET_WORKSPACE` | provider Bitbucket |
| `BITBUCKET_REPOS` | opcional, lista separada por comas; vacío = todos los del workspace |
| `GITHUB_TOKEN` | provider GitHub |
| `PR_SYNC_CRON` | por defecto cada 30 min |
| `REVIEW_CONCURRENCY` | cuántas PRs se revisan a la vez; por defecto `1`, mínimo `1` |
| `AGENT_TIMEOUT_MS` | timeout del agente, por defecto 10 min |
| `CLAUDE_BIN` | opcional, ruta del CLI de Claude |

## 6. Riesgos y decisiones de diseño

1. **Prompt injection.** El contenido de una PR es entrada no confiable. Mitigación: herramientas de
   solo lectura validadas en la entidad `Agent`, y checkout temporal que se borra siempre.
2. **Tokens.** Bitbucket exige el token en la URL del clone. Debe quedar solo en el adaptador de
   checkout, nunca en logs ni en `last_error` (limpiar el stderr antes de guardarlo).
3. **Comentario fallido ≠ revisión perdida.** Se guarda la `Review` antes de comentar; el comentario
   tiene su propio estado y su reintento.
4. **Cola en la BD, límite en memoria.** Sin Redis. El orden y el estado viven en `pull_requests`; el
   contador de workers activos vive en memoria. Si el servidor se reinicia, las `reviewing` pasan a
   `failed` y las `pending` se retoman solas. Subir `REVIEW_CONCURRENCY` multiplica el consumo de CPU
   y el gasto de Claude, y varios checkouts temporales conviven en disco.
5. **Timeout.** Sin él, una PR enorme puede dejar colgada toda la cola.
6. **Costo.** Cada re-revisión paga una ejecución completa. Es manual a propósito.
7. **PRs cerradas.** Dejan de listarse y pasan a `closed`; no se borran.

## 7. Cambios al proyecto existente

- `tsconfig.json`: alias `@ai-agents/*` y `@pr-review/*`.
- `package.json` (jest): `moduleNameMapper` para los dos alias nuevos. Hoy solo existe `@tasks`, así
  que `@kanban` y `@time-tracking` tampoco resuelven en los tests; conviene arreglarlo en el mismo
  cambio.
- `app.module.ts`: importar `AiAgentsModule` y `PrReviewModule`.
- `env.validation.ts`: variables nuevas, con validación por provider.
- `npm install @nestjs/schedule`.
- Wiring con el checklist de `07-reglas-y-errores-comunes.md`: todo controller y service declarado en
  su `@Module`, y los módulos importados desde `AppModule`.

## 8. Fases de implementación

1. **Base de `ai-agents`**: alias, módulo, entidad `Agent`, ORM entity, repositorio, servicio, CRUD
   HTTP, migración con el agente sembrado.
2. **Runner de Claude**: `AgentRunnerPort` y `ClaudeCliAgentRunnerAdapter` con timeout; probar un
   `run` real a mano contra un directorio de prueba.
3. **Base de `pr-review`**: entidades de dominio, ORM entities, repositorios y migración.
4. **Bitbucket + sync**: client, adaptador, `PullRequestsService.sync()`, `POST /sync` y endpoints de
   lectura.
5. **Revisión y cola**: checkout, storage local, `AgentsGatewayAdapter`, `claimNextPending`,
   `ReviewsService` con `kick()`/workers y `REVIEW_CONCURRENCY`, `re-review` (202), `GET /queue` y
   lectura del `.md`.
6. **Comentarios**: `PullRequestCommentPort` en Bitbucket, `comment_status` y `retry-comment`.
7. **Scheduler**: cron (sync + `kick()`) y recuperación al arrancar.
8. **GitHub**: client y adaptador; la interfaz ya queda probada con Bitbucket.
9. **Tests**: unitarios de entidades y servicios con puertos falsos, y un e2e del flujo
   sync → revisión con providers y runner falsos.

## 9. Checklist de arquitectura (para revisar cada PR de esta funcionalidad)

- [ ] `domain/` no importa TypeORM, Axios, `child_process` ni NestJS.
- [ ] Los controllers y el scheduler solo hablan con servicios.
- [ ] Ningún servicio de aplicación hace I/O directo (git, procesos, disco): todo pasa por un puerto.
- [ ] `pr-review` solo importa `ai-agents` dentro de `agents-gateway.adapter.ts`.
- [ ] Los adaptadores traducen; no orquestan ni dependen de otros puertos de paso.
- [ ] Todo controller, service y puerto nuevo está registrado en su módulo.

## 10. Estado de la implementación

Implementado: fases 1 a 9 del plan, incluida la cola con `REVIEW_CONCURRENCY`. Quedan fuera,
como se acordó, `contextDirs`/`contextRepos` y la edición de la concurrencia por API.

Cambios respecto al plan original:

- **Errores de dominio.** Se agregó `DomainError` (`src/core/domain`) y un filtro global
  (`src/core/http/domain-error.filter.ts`) que lo traduce a 400 (`validation`) o 409 (`conflict`).
  Los errores de las entidades nuevas se devuelven así en vez de un 500.
- **Token fuera del clone.** `GitCliCheckoutAdapter` usa el token solo para el `clone` y deja el
  remoto `origin` sin credenciales, para que el agente no pueda leerlo desde `.git/config`.
  También rechaza nombres de rama o repo que puedan inyectar opciones de `git`.
- **Sync seguro.** El puerto de fuente devuelve `unreachableRepos`; las PRs de un repo que no se
  pudo consultar (o de un provider caído) no se dan por cerradas.
- **Revisiones fallidas.** También se guardan en `reviews` (`status = failed`), para tener historial
  de errores.
- **Commit revisado.** Se toma del checkout real (`git rev-parse HEAD`), no del último sync.
- **Docker.** `deploy/dev/Dockerfile` ahora instala `git` y el CLI de Claude.

Limitaciones conocidas:

- **Login de Claude en Docker.** Dentro del contenedor el CLI no tiene sesión. Con plan Pro/Max: ejecutar `claude setup-token` en el host y poner el token en `.env` como `CLAUDE_CODE_OAUTH_TOKEN` (usa la suscripción, sin API key). El consumo cuenta contra los límites de uso del plan.
- **PRs desde forks.** El checkout asume que la rama de la PR existe en el repo destino.
- **GitHub.** `review-requested:@me` deja de listar la PR cuando el usuario ya envió su review, y
  entonces el sync la marca `closed`.
- **Primer sync.** Todas las PRs abiertas donde eres reviewer entran a la cola a la vez.
- **Migraciones.** `npm run migration:run` también aplica las pendientes anteriores
  (`IssueLocalSequence`, `ProjectSourceAndLocalCreation`). Kanban todavía no tiene migración.
