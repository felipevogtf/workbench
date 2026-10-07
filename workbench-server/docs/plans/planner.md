# Plan: planificador de tareas con agentes por módulo

Estado: **propuesta, sin implementar**. Agrega un módulo **planificador** que, desde una tarea, pide a un agente de IA un
**plan de ejecución** en markdown. Para que sirva a la vez a la revisión de PRs y a la planificación, los agentes pasan a
pertenecer a un **módulo** (cada módulo tiene su propio agente por defecto). Sigue la arquitectura hexagonal del
backend y la estructura modular del front (ver [pr-review.md](./pr-review.md) y
[tasks-kanban-ui.md](../../../workbench-app/docs/plans/tasks-kanban-ui.md)).

## 1. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Entrada | El plan se pide **desde una tarea** (detalle de la tarea). |
| Contexto de código | Las **etiquetas** pueden tener un **enlace de repositorio** (ej. etiqueta «MiCamión Web» → su repo). La tarea sabe qué repos leer por sus etiquetas. **Sin etiquetas con repo, planifica sin código.** |
| Agentes | Un agente pertenece a un **módulo** (`pr-review`, `planner`, y los que se sumen). Hay **un agente por defecto por módulo**. |
| Proveedores | El planificador funciona con cualquier proveedor ya configurado (Claude, Copilot, Antigravity). |
| Rama | Solo `main`; si el repo no la tiene, `master`. |
| Dónde se ve | **Solo en el detalle de la tarea** (no en Kanban ni en otras pantallas). |
| Formato | El plan es un **markdown guardado en la base**; se ve renderizado y se copia o descarga como `.md`. No se guarda como archivo en disco. |
| Alcance del plan | Solo texto: no crea subtareas ni cambia las horas estimadas. |

## 2. Alcance

Dentro: agentes con módulo; enlace de repo en etiquetas; entidad **Plan** (historial por tarea); generación en segundo
plano con cola; panel «Plan de ejecución» en el detalle de la tarea; agente `default-planner` de fábrica.

Fuera: crear subtareas o editar horas a partir del plan, planificar varias tareas a la vez, que el agente escriba en Plane,
y mostrar o pedir planes desde Kanban u otras pantallas (el plan vive solo en el detalle de la tarea).

## 3. Cambio en los agentes: módulo por agente

### Dominio (`ai-agents`)
- `Agent.module`: `'pr-review' | 'planner'` (lista cerrada en `domain/modules.ts`; sumar un módulo es agregar un valor).
- **Por defecto por módulo:** `isDefault` deja de ser global. `AgentRepositoryPort` pasa a `findDefault(module)` y
  `clearDefault(module)`. Marcar uno como por defecto solo desmarca el de **su** módulo.
- **Herramientas permitidas por módulo** (siguen siendo solo lectura): una tabla `MODULE_TOOLS` en el dominio.
  - `pr-review`: la actual (`Read`, `Grep`, `Glob`, `git diff`, `git log`, `git show`).
  - `planner`: `Read`, `Grep`, `Glob`, `git log`, `git show` (no necesita `git diff`).
  - La entidad valida contra la lista de **su** módulo.
- `AgentsService.run({ module, agentId?, ... })`: sin `agentId` usa el por defecto **del módulo** que llama; si el agente
  indicado es de otro módulo, rechaza (400).
- `pr-review` pasa a llamar con `module: 'pr-review'` (cambio de una línea en `AgentsGatewayAdapter`).

### Migración
- Columna `module varchar not null default 'pr-review'`: **los agentes actuales quedan en `pr-review`** y nada cambia en las
  revisiones.
- Seed de `default-planner` (módulo `planner`, proveedor `claude`, modelo `claude-sonnet-5-5`, por defecto de su módulo)
  con el prompt de la sección 7.

### API y front de agentes
- `POST/PATCH /agents` aceptan `module`; `GET /agents?module=planner` filtra.
- Formulario: selector **Módulo** (un campo por fila, como el resto). Al cambiarlo se actualiza la lista de herramientas
  permitidas. La lista de agentes se agrupa por módulo y cada tarjeta muestra el suyo; «Por defecto» es por módulo.
- `AgentsStore.defaultAgent` pasa a `defaultAgentOf(module)`. La revisión de PRs usa el de `pr-review`.

## 4. Etiquetas con repositorio

- `Label.repoUrl` (nullable). Regla de dominio: debe ser `https://github.com/<org>/<repo>` o
  `https://bitbucket.org/<ws>/<repo>` (sin credenciales, sin `.git` obligatorio; se normaliza). Cualquier otra cosa → 400.
- Migración: columna `repo_url varchar null` en `labels`.
- API: `repoUrl` en el POST/PATCH de etiquetas y en la respuesta.
- Front: el diálogo de etiquetas gana el campo **Repositorio (opcional)**; en la lista una etiqueta con repo muestra un ícono
  de enlace.
- **Rama:** solo `main`, o `master` si no existe `main`. No hay campo de rama en la etiqueta. Si el repo no tiene ninguna de
  las dos, no se clona y el plan lo anota (planifica con los demás repos o sin código).

## 5. Módulo `planner` (backend)

```
src/planner/
  domain/
    entities/plan.entity.ts + plan.props.ts     Plan (create / reconstruct / markGenerating / complete / fail)
    ports/plan-repository.port.ts
    ports/tasks-gateway.port.ts                 tarea + etiquetas + estado (lo implementa un adaptador sobre @tasks)
    ports/agents-gateway.port.ts                run({ module: 'planner', agentId?, model?, prompt, workdir })
    ports/repository-checkout.port.ts           clona repos de solo lectura a un directorio temporal
    ports/tickets-gateway.port.ts               tickets de Plane citados en la descripción
    plan-prompt.ts                              arma el prompt (función pura, con tests)
  application/
    plans.service.ts                            crear / listar / obtener / borrar; cola y workers
  dto/  create-plan.dto.ts, plan-response.dto.ts
  infrastructure/
    http/plans.controller.ts
    persistence/plan.orm-entity.ts
    repositories/typeorm-plan.repository.ts
    adapters/tasks-gateway.adapter.ts           usa el puerto público de @tasks
    adapters/agents-gateway.adapter.ts          usa AgentsService
    adapters/git-checkout.adapter.ts            ver sección 5.2
    adapters/tickets-gateway.adapter.ts         reutiliza TicketLookupService
```

Dependencias entre módulos: `planner` → `tasks` y `ai-agents` (solo por sus servicios/puertos exportados, nunca al
revés), igual que `pr-review` hoy.

### 5.1 Entidad Plan

| Campo | Notas |
|---|---|
| `id`, `issueId` | Varios planes por tarea (historial); el panel muestra el último. |
| `status` | `pending` → `generating` → `ready` \| `failed`. |
| `content` | Markdown del plan (texto en la base; se descarga como `.md` desde el front, no se escribe en disco). |
| `agentId`, `agentName`, `model` | Instantánea de quién lo generó. |
| `repos` | Lista de repos usados (instantánea; vacía si planificó sin código). |
| `error` | Mensaje si falló. |
| `createdAt`, `updatedAt` | |

Un plan nunca se re-genera «en el mismo registro»: pedir otro crea uno nuevo (queda el historial para comparar).

### 5.2 Repositorios por etiquetas

1. Se leen las etiquetas de la tarea y se toman las que tienen `repoUrl` (sin repetidos). **Máximo 3** por plan; si hay más,
   el plan se genera con los 3 primeros por nombre y lo informa (evita clonar de más).
2. Cada repo se clona **superficialmente** (`--depth 1 --branch main`, y si falla, `--branch master`) en un subdirectorio de un directorio temporal; el agente corre con
   ese directorio como `cwd` (`repo-a/`, `repo-b/`). Se borra al terminar, con éxito o con error.
3. Credenciales: las de Bitbucket/GitHub que el servidor ya usa para las PRs, **solo durante el clone**; el remote queda sin
   credenciales y ningún CLI de IA recibe esos tokens (igual que hoy).
4. Si **no hay repos** (o un clone falla, o no existe ni `main` ni `master`), el plan se genera **sin código** y el prompt lo dice explícitamente; un clone
   fallido se anota en el plan (`repos` con su error), no lo bloquea.
5. El checkout de PRs ya existe (`GitCliCheckoutAdapter` en `pr-review`). Para no duplicar lógica de git, la parte común
   (clone seguro, validación de URL/rama, quitar credenciales, borrar el directorio) se extrae a un helper en
   `core/` que usan ambos adaptadores.

### 5.3 Cola y concurrencia

Mismo patrón que las revisiones: la base es la cola (reclamo atómico del siguiente `pending`), workers dentro del proceso y
`recoverInterrupted()` al arrancar (los `generating` huérfanos pasan a `failed`). Variable **`PLANNER_CONCURRENCY`** (≥ 1,
por defecto 1). Usa `AGENT_TIMEOUT_MS`. Es independiente de `REVIEW_CONCURRENCY`.

### 5.4 API

| Ruta | Descripción |
|---|---|
| `POST /issues/:issueId/plans` | Crea un plan en cola (`202`). Cuerpo opcional: `agentId`, `model`. |
| `GET /issues/:issueId/plans` | Historial de la tarea (más nuevo primero), sin el contenido. |
| `GET /plans/:id` | Un plan con su markdown y estado. |
| `DELETE /plans/:id` | Borra un plan (no uno en generación). |

Errores: tarea inexistente → 404; agente de otro módulo o proveedor deshabilitado → 400; ya hay un plan `pending` o
`generating` de esa tarea → 409 (evita duplicados por doble clic).

## 6. Front (módulo `tasks`)

El panel es una función de la tarea, así que vive en `tasks/` (no en un módulo aparte, para no crear una dependencia circular).

- `data-access/plans.api.ts` y `plans.store.ts` (por tarea abierta; con sondeo cada 3 s mientras haya un plan `pending` o
  `generating`, igual que las PRs).
- `components/plan-panel/`: tarjeta **«Plan de ejecución»** en el detalle de la tarea:
  - botón **Generar plan** (y **Volver a generar** si ya hay uno), con un selector opcional de agente del módulo `planner`;
  - estado (`En cola`, `Generando…`, `Listo`, `Falló` con el mensaje y **Reintentar**);
  - el plan renderizado con `MarkdownViewer`, y acciones **Copiar** y **Descargar .md** (ya existe `downloadText`);
  - historial colapsable de planes anteriores;
  - aviso «Se usaron los repos: …» o «Sin repositorio: planificó solo con la tarea», para que se vea el contexto.
- El panel solo existe en el detalle de la tarea.
- Si la tarea no tiene etiquetas con repo, el panel lo dice y enlaza a **Etiquetas** para configurarlo.
- Etiquetas: campo **Repositorio** en el diálogo (reutiliza `NamedItemDialog` ampliando sus campos opcionales).
- Agentes: selector **Módulo** y agrupación (sección 3).

Responsive y estilo: se reutilizan `Card`, `Badge`, `Button`, `Menu`, `MarkdownViewer` y los patrones de la página de PRs.

## 7. Prompt del planificador

El prompt del **agente** (editable en la UI, módulo `planner`) define el formato; el contexto de la tarea lo arma el backend
(`plan-prompt.ts`).

Agente `default-planner` (resumen del prompt inicial):

> Eres un planificador técnico senior. Con la tarea y, si existen, los repositorios que se indican, escribe un plan de
> ejecución en español y en Markdown con: **Objetivo**, **Qué entendí / supuestos y dudas**, **Pasos** (ordenados, cada uno con
> los archivos o módulos concretos a tocar si hay código), **Riesgos**, **Cómo probarlo** y **Estimación de horas** (con el
> razonamiento). Si no hay repositorio, dilo y planifica a nivel funcional sin inventar archivos. Solo lectura.

Contexto que arma el backend: nombre y descripción de la tarea (HTML de Plane convertido a texto, ya existe `html-to-text`),
proyecto, estado, prioridad, fechas, horas estimadas y registradas, etiquetas, **tickets de Plane citados** en la descripción
(con `TicketLookupService`, sin bloquear si Plane no responde) y la lista de repos clonados con su ruta relativa.

## 8. Seguridad

- Agentes de **solo lectura** con herramientas por módulo (sección 3); un agente nunca ejecuta ni escribe.
- La descripción de la tarea y el código de los repos son texto no confiable (inyección de prompt): el agente no tiene cómo
  actuar con él más que leer.
- Solo se clonan URLs de github.com y bitbucket.org con el formato validado, sin esquemas raros ni credenciales embebidas.
- Los tokens de git no llegan a los CLI de IA; el directorio temporal se borra siempre.

## 9. Fases

1. **Agentes por módulo.** Campo `module`, defecto por módulo, herramientas por módulo, migración (con seed de
   `default-planner`), API, formulario y lista. Verificar que las revisiones de PRs no cambian.
2. **Etiquetas con repo.** Campo, validación, migración, API y diálogo.
3. **Módulo `planner` (backend).** Entidad, puertos, extracción del helper de git a `core`, checkout de repos, prompt,
   cola, API y migración de la tabla `plans`. Tests: entidad, `plan-prompt`, servicio (con puertos falsos) y validación de URL.
4. **Front.** Store, panel en el detalle de la tarea, sondeo, historial, copiar y descargar.
5. **Cierre.** Prueba real con una tarea con y sin repo (con Claude y con Copilot), documentación y despliegue (con la cola
   de revisiones vacía; las migraciones corren al arrancar).

## 10. Riesgos

1. **Clones grandes o lentos.** Mitigación: `--depth 1`, máximo 3 repos y el timeout del agente; si un clone falla se
   planifica con el resto.
2. **Cuota de los proveedores.** Un plan con código gasta más que una revisión pequeña; la cola de 1 limita el consumo.
3. **Prompt largo en Copilot/Antigravity** (se pasa por argumento): descripciones enormes podrían exceder el límite. El
   backend recorta la descripción a un máximo razonable y lo avisa en el contexto.
4. **Defecto por módulo cambia un invariante** (antes había un solo agente por defecto). La migración lo conserva para
   `pr-review`, y hay test de que marcar uno solo afecta a su módulo.
5. **Calidad del plan sin código.** Es una limitación esperada; el panel avisa cuando no hubo repo.

## 11. Preguntas resueltas

1. **Rama:** solo `main` (o `master` si no hay `main`).
2. **Kanban:** no; el plan se ve y se pide solo en el detalle de la tarea.
3. **Subtareas u horas desde el plan:** no.

## 12. Criterios de aceptación

- Un agente tiene módulo; hay un agente por defecto por módulo; las revisiones de PRs siguen usando el suyo sin cambios.
- Una etiqueta guarda un enlace de repo válido y rechaza los inválidos.
- Desde el detalle de una tarea se genera un plan: pasa por `En cola` → `Generando` → `Listo`, se ve renderizado, se copia
  y se descarga, y queda en el historial.
- Con una tarea cuyas etiquetas tienen repo, el agente lee ese código; sin repo, planifica sin código y el panel lo indica.
- Un fallo (CLI, clone, timeout) deja el plan en `Falló` con el motivo y permite reintentar; un reinicio no deja planes en
  `Generando` para siempre.
- Lint, tests y build de ambos proyectos pasan, y no se pierde ninguna función de la revisión de PRs.
