# Rediseño de las ejecuciones

Qué se quiere, cómo se parte el trabajo y en qué orden. Todo lo de Lucy aplica **antes del play**, mientras la ejecución es un borrador.

## Lo que se pide

1. El chat se abre lateralmente.
2. La página es de ancho completo, como el tablero y el organizador.
3. Los tickets se abren en un modal, no en un panel lateral.
4. Lucy puede crear, eliminar, modificar y reasignar tickets.
5. Lucy crea los tickets sin pedir confirmación.
6. Un botón de play ejecuta la ejecución. Antes de pulsarlo se mejoran, agregan y quitan tickets con Lucy.
7. Se ven los proyectos que involucra la ejecución (`melon-web`, `miflota-web`, …).

## Decisiones tomadas

- **Solo tickets `pending`.** Lucy no toca un ticket que ya empezó o terminó. Antes del play todos están `pending`, así que la regla solo importa más adelante.
- **La regla se aplica en el servidor**, no solo en el prompt de Lucy. Si el modelo intenta cambiar un ticket que no está `pending`, el servidor lo rechaza.
- **Notas.** Siguen igual para tickets `pending` y se guardan sin botón de confirmación. Lucy prefiere editar el ticket cuando el cambio es parte del plan, y deja la nota solo para indicaciones de cómo trabajar. Las notas que reabren un ticket de una ejecución completada no cambian: se mantienen con confirmación.
- **Sin confirmación, con deshacer.** Cada cambio de Lucy queda en un historial con un botón «Deshacer». Eliminar no borra de verdad: el ticket queda marcado como eliminado y se puede restaurar.
- **Después del play** valen las reglas de hoy (nota con confirmación, ticket nuevo, revisión final, repos). Que Lucy cambie tickets `pending` con la ejecución en marcha queda para una segunda fase.

## Orden de ejecución

Cada fase se puede entregar y probar sola. Una fase no empieza hasta que la anterior funciona.

### Fase 1 · Interfaz (puntos 1, 2, 3 y 7)

Cambio visual, sin tocar la lógica del servidor.

1. **Página de ancho completo** en `execution-page`: el tablero ocupa todo el ancho, como kanban y organizador.
2. **Ticket en modal.** El contenido de `ticket-panel` pasa a un modal (descripción, criterios, registro, preguntas, revisión). Se reutiliza casi entero; se quita el panel lateral.
3. **Chat en cajón lateral** que se abre y se cierra, con un botón siempre visible. Es el componente `execution-chat` actual, solo cambia dónde se muestra.
4. **Proyectos involucrados.** Chips junto al encabezado con cada repo de `execution.repos`, su rama y su PR cuando exista. Al pulsar un chip se filtra el tablero por ese repo.

Listo cuando: la página usa todo el ancho, un ticket se abre en modal, el chat se abre al costado y se ven los repos.

### Fase 2 · Borrador y play (punto 6)

1. **Estado nuevo `draft`** antes de `awaiting`. La ejecución nace en borrador y Lucy genera el plan inicial de tickets (como hoy).
2. **Botón de play fijo** en la cabecera, siempre visible. Reemplaza al «Empezar el desarrollo», que hoy solo aparece en `awaiting`. Pasa la ejecución a `running`.
3. Mientras es borrador, el tablero y el chat siguen disponibles para ajustar tickets.
4. Tests del dominio: transiciones válidas (`draft` → `running`) y rechazo del play sin tickets.

Listo cuando: se crea una ejecución, se queda en borrador con sus tickets y solo empieza al pulsar play.

### Fase 3 · Lucy con herramientas (puntos 4 y 5)

Es el cambio grande.

1. **Operaciones sobre tickets** en el dominio de la ejecución: crear, modificar (título, descripción, criterios, nivel, repo), eliminar y reasignar. Cada una exige que el ticket esté `pending` y que la ejecución sea un borrador.
2. **Historial de cambios.** Cada operación guarda cómo estaba el ticket antes. Eliminar marca el ticket como eliminado en vez de borrarlo.
3. **Deshacer / restaurar** como operación del servidor, usando ese historial.
4. **Prompt y formato de Lucy.** Lucy emite sus acciones en un formato que el servidor interpreta y aplica de inmediato, sin propuesta pendiente. Se actualizan `execution-chat-prompt.ts` y `chat-proposals.ts`. Las notas se guardan igual, sin botón.
5. **Interfaz.** Bajo cada cambio de Lucy en el chat: «Eliminé el ticket *X* · Deshacer». En el tablero, una marca de «cambiado por Lucy» en los tickets tocados.
6. **Tests.** Cada operación, el rechazo de tickets que no están `pending` y el deshacer.

Listo cuando: Lucy crea, edita, elimina y reasigna tickets del borrador sin preguntar, cada cambio se puede deshacer y un ticket que no está `pending` se rechaza.

### Fase 4 · Después (opcional)

- Que Lucy cambie tickets `pending` con la ejecución ya en marcha, cuidando que el runner no esté tomando ese ticket en ese momento.
- Revisar cuántas llamadas a Claude gasta el chat con tantas acciones.

## Estado

- **Fase 1 · Interfaz: hecha (2026-11-19).** La ruta de la ejecución es de ancho completo (`immersive`, como el tablero y el organizador). El ticket abre en un modal centrado (se reutilizó `ticket-panel`, solo cambia cómo se ubica). El chat de Lucy es un cajón a la derecha que se abre con un botón fijo en la cabecera, con el contador de mensajes sin leer; sigue montado aunque esté cerrado, para que Lucy pueda avisar de una pregunta nueva. Los proyectos de la ejecución son chips con su rama, cuántos tickets tienen y su PR; con varios proyectos, pulsar un chip filtra el tablero. Sin cambios en el servidor.
- **Fase 2 · Borrador y play: hecha (2026-11-19).** Se decidió **no** sumar un estado nuevo junto a `awaiting`: ese estado ya era el borrador (tickets listos, esperando el visto bueno), así que se reemplazó por `draft`, que ahora empieza **desde que se crea la ejecución** y cubre también el tiempo en que Lucy crea los tickets. La migración `ExecutionDraft` renombra los `awaiting` que hubiera. El play (`begin`) solo vale sobre un borrador cuyos tickets ya se crearon y que tenga alguno por hacer; si no, el servidor responde 409. Un reintento tras fallar al crear los tickets vuelve a ser borrador; uno posterior vuelve a `running`. En la cabecera hay un botón **Ejecutar** que existe desde el borrador y está deshabilitado (con el motivo en su ayuda) mientras Lucy crea los tickets o si no hay nada por ejecutar; reemplaza a «Empezar el desarrollo». Probado de punta a punta: la ejecución nace en borrador, sigue en borrador con los tickets listos y se cancela sin publicar nada.
- **Fase 2, ajuste (2026-11-19):** los tickets que crea Lucy entran directo al tablero, en «Pendiente» y ya asignados según su recomendación, en vez de una pantalla de asignación aparte. Quién los hace se cambia desde el ticket (el modal, mientras es borrador).
- **Fase 3 · Lucy con herramientas: hecha (2026-11-19).** En un borrador con sus tickets ya creados, Lucy escribe líneas de acción en su respuesta y el servidor las aplica **al terminar**, sin confirmación: `CREAR`, `EDITAR <n> | campo | valor`, `ELIMINAR <n>`, `REASIGNAR <n> | desarrolla/revisa | nombre` y `NOTA <n>:` (la nota se guarda al instante, sin botón; con la ejecución completada las notas siguen con confirmación). Los números son los del listado que Lucy vio, así que no se mueven si en la misma respuesta elimina o crea otros. Reglas en el servidor (dominio `Execution`): solo en borrador, solo con los tickets ya creados, solo sobre tickets pendientes, máximo 15 tickets; lo que no se puede se devuelve con su motivo y se le dice al usuario al final de la respuesta, el resto se aplica. Cada cambio queda en un historial (`ticket_history`, con lo que hace falta para deshacerlo) y eliminar no borra: el ticket se guarda y deshacer lo restaura en su lugar. Endpoint `POST /executions/:id/changes/:changeId/undo`. En la pantalla: el cajón del chat lista los cambios de Lucy (el más nuevo primero) con «Deshacer», y las tarjetas tocadas por ella llevan la marca «Cambiado por Lucy». Probado de punta a punta con Lucy real: nivel, ticket nuevo y nota en un solo mensaje, deshacer la creación y rechazo del segundo deshacer.
- **Chat redimensionable:** el cajón de Lucy se ensancha arrastrando su borde izquierdo (o con las flechas); mínimo 320 px, máximo 70 % de la pantalla, y recuerda el ancho.
- **Pendiente de la Fase 3:** al cambiar el nivel de un ticket el desarrollador no se reasigna solo (Lucy lo advirtió en la prueba); hoy hay que pedirle el cambio.

## Riesgos a vigilar

- **Costo del chat.** Cada vuelta de Lucy es una llamada de Claude en el runner. Con herramientas que aplican cambios, conviene que una sola respuesta pueda traer varias acciones.
- **Carrera con el runner.** En la fase 3 no existe, porque el borrador no tiene trabajos corriendo. Aparece en la fase 4.
- **Despliegue.** El runner y el servidor se actualizan por separado. Si una fase cambia el formato que el servidor manda al runner, hay que desplegar los dos en orden.
