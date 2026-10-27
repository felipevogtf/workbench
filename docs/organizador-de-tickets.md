# Organizador: planificar y ejecutar varios tickets juntos

Estado: **plan, nada construido** (2026-10-27). Lo motiva un caso real: varias tareas que dependen entre sí y tocan los mismos repos.

## Problema

El hub planifica y ejecuta **un ticket a la vez** (tarea → plan → ejecución). Con tickets relacionados eso falla:

- El plan de una tarea se genera leyendo la rama principal, que todavía no tiene el código de la tarea anterior de la que depende.
- Las tareas que cambian los mismos textos o archivos chocan al mergear.
- Hacerlos en serie obliga a mergear y desplegar entre uno y otro: seis PRs en cadena.

## Qué se quiere

Un menú **Organizador**: un chat de pantalla completa con el planificador donde se agregan varios tickets de Plane, se conversa, se genera **un solo plan
para todos** y, cuando está bien, se ejecuta. El resultado es **una rama y una PR por repo**, con los tickets en el orden de sus dependencias.

## Decisiones tomadas

- **Un grupo es una tarea.** El plan, la ejecución, la rama y la PR ya cuelgan de una tarea (`issueId`) y todo lo que necesitan lo piden por un único punto, `getTask()`.
  Si ese punto sabe armar un grupo, plan y ejecución no cambian.
- **Una PR por repo** para el grupo (no PRs apiladas por ticket). Apilarlas exigiría rama base elegible y PR contra la rama padre; queda fuera.
- **El organizador no ve el entorno.** Lee los repos como el chat de tareas de hoy (rama principal, sin dependencias instaladas). Lo que dependa de `vendor/` lo
  verifica Lucy al crear los tickets internos (ver «Cambio en Lucy»). Dar entorno al chat del organizador (una carpeta temporal por repo, sin ejecución) queda como
  etapa futura.
- **El orden lo pone el usuario** dentro del grupo. Leer las relaciones «bloquea a» de Plane para proponerlo queda para después.

## Etapa A: el grupo (servidor)

1. **Datos.** Tabla `issue_group_members(group_issue_id, member_issue_id, position)`. El grupo es una tarea local (`issues.is_local`) marcada como grupo (columna nueva,
   para mostrarla distinta en la lista y el tablero). Los miembros siguen siendo los tickets de Plane. Migración con la que ya usa el proyecto.
2. **Composición, en un solo lugar.** Hoy hay dos adaptadores que arman la tarea: `executions/infrastructure/adapters/tasks-gateway.adapter.ts` y
   `planner/infrastructure/adapters/tasks-gateway.adapter.ts`. La composición va en `TasksFacade` (módulo tasks) y los dos la usan:
   - **descripción:** una sección por miembro, en orden, con su código, título y criterios de aceptación, más una nota de dependencias (qué usa cada uno de lo que crea otro);
   - **repos:** la unión de las etiquetas de repo de los miembros (hoy un máximo de 3 repos por ejecución);
   - **código:** los códigos de los miembros unidos (por ejemplo `ABC-1·2·3`), que alimenta el nombre de la rama (`branchNameFor`) y el título de la PR.
3. **Prompts.**
   - Plan (`planner/domain/plan-prompt.ts`): «es un grupo de tickets: ordena por dependencias, backend antes que app, rotula cada paso con su ticket».
   - Creación de tickets internos (`buildTicketsPrompt`): mismos criterios; un ticket interno no mezcla miembros.
   - Revisión final (`buildFinalReviewPrompt`): verificar los criterios de aceptación de **cada** miembro por separado, no solo el conjunto.
4. **PR.** La descripción lista cada miembro con su enlace (se arma en `ExecutionsService` al publicar), para no perder la trazabilidad 1 a 1.
5. **Reglas.** Un ticket que es miembro de un grupo abierto no se planifica ni se ejecuta por separado (`start` y la creación de planes lo rechazan). Al completar la
   ejecución del grupo, los miembros se marcan cerrados en el hub (`closedAt`). Escribir estados en Plane queda fuera.

## Etapa B: el Organizador (servidor y pantalla)

**Servidor** (módulo nuevo `organizer`, con la estructura de los demás: dominio, aplicación, infraestructura):

- Entidad **sesión**: título, tarea-grupo asociada, conversación (jsonb, como `plans.conversation`), estado.
- Endpoints: crear y listar sesiones; agregar un miembro por código (con `TicketLookupService.findByKey`); quitar; reordenar; **chat**; **crear plan**; **ejecutar**.
- **Chat:** reutiliza lo del `TaskChatService` (lee los tickets de Plane que se mencionan, hasta 5, adjuntos, el último plan, el código de los repos de las
  etiquetas), con un prompt propio (`organizer-chat-prompt`) que habla de varios tickets y de su orden.
- **Crear plan:** `PlansService.create` sobre la tarea-grupo, con la conversación (igual que una replanificación). **Ejecutar:** `ExecutionsService.start` sobre la misma.

**Pantalla** (`workbench-app/src/app/organizer/`, ruta `organizer`, entrada en el menú):

- Lista de sesiones y vista de sesión a pantalla completa: chat al centro; panel lateral con los tickets (agregar por código, reordenar, quitar), el plan
  y los botones «Crear plan» y «Ejecutar».
- Reutiliza el componente y el store del chat de tareas, los adjuntos del chat y el panel del plan.

## Cambio en Lucy (crear los tickets internos con entorno)

Hoy el trabajo `tickets` corre **sin entorno** y solo con herramientas de lectura; luego la ejecución espera tu visto bueno (`awaitStart`). Se le da entorno para que
verifique el plan contra el código instalado antes de ese visto bueno:

- `workbench-runner/src/jobs.ts`: el trabajo `tickets` deja de saltarse el entorno y usa la misma lógica que el chat con varios repos (levanta el de cada repo con
  entorno; `docker compose` apunta a uno). El entorno que levanta lo reutiliza después el desarrollador.
- `environment.ts` (`environmentTools`): `tickets` recibe las herramientas de solo lectura del entorno, como `review`. `jobs.ts` descarta lo que deje en los archivos, como
  con `review`. `config.ts`: subir el tiempo de `tickets` (15 min) por el arranque del entorno.
- `buildTicketsPrompt`: «verifica lo que el plan afirma contra el código instalado (también las dependencias); si no calza, corrige los tickets y anota en su descripción qué
  cambió y por qué».

## Pruebas

- Servidor: composición del grupo (descripción, unión de repos, código, orden); regla de exclusión; sesión y sus endpoints; que el plan y la ejecución se pidan
  sobre la tarea-grupo; prompts nuevos.
- Runner: el trabajo `tickets` levanta el entorno (principal y otros repos), descarta cambios y no deja nada colgado.
- App: la lista y la vista de sesión con su store, como las de `tasks`.
- **Prueba de aceptación con datos reales:** crear un grupo de tres tareas dependientes que tocan dos repos, planificarlo, ejecutarlo y ver que sale una rama y una PR por repo,
  con las tareas en el orden de sus dependencias y los tres códigos en la PR.

## Orden de trabajo

1. **A** (servidor): migración, composición, prompts, PR, reglas.
2. **Cambio en Lucy** (runner y prompt), independiente de A y B.
3. **B** servidor, luego **B** pantalla.
4. Prueba de aceptación con los tres tickets.

Esfuerzo orientativo: A y el cambio en Lucy, una sesión cada uno; B, dos (con la pantalla).

## Riesgos y fuera de alcance

- Sin dependencias instaladas, el plan del organizador puede traer supuestos sin comprobar: lo cubre Lucy con el cambio de arriba y el visto bueno antes de desarrollar.
- El runner hace **un trabajo a la vez**: crear los tickets con entorno puede esperar detrás de otra ejecución.
- Lo que un agente no puede producir (archivos binarios como audios o imágenes) lo pone una persona.
- Fuera de alcance: PRs apiladas por ticket, entorno para el chat del organizador, leer relaciones de Plane, escribir estados en Plane.
