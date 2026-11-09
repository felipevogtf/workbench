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

## Riesgos a vigilar

- **Costo del chat.** Cada vuelta de Lucy es una llamada de Claude en el runner. Con herramientas que aplican cambios, conviene que una sola respuesta pueda traer varias acciones.
- **Carrera con el runner.** En la fase 3 no existe, porque el borrador no tiene trabajos corriendo. Aparece en la fase 4.
- **Despliegue.** El runner y el servidor se actualizan por separado. Si una fase cambia el formato que el servidor manda al runner, hay que desplegar los dos en orden.
