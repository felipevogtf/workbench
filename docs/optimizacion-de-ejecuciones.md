# Optimización de las ejecuciones: lo que se hace ahora

Acordado el 2026-10-26. Cuatro cambios, en este orden (el último, al final), cada uno con su commit y sus tests.
Antes, lo que ya quedó hecho.

## Hecho: los agentes no tocan los submódulos (commit `0612d52`, runner reiniciado)

Una ejecución falló con `git commit falló … modified: src/mipedido (modified content)`: el agente editó dentro de un
submódulo, que es otro repositorio, y git no puede agregar ese cambio. Ahora el runner, para cualquier submódulo
listado en `.gitmodules`:

- agrega al prompt de cada trabajo la lista de submódulos y la orden de no tocarlos;
- descarta los cambios que hayan quedado ahí al empezar cada trabajo y antes del commit;
- commitea solo lo que es del repo; si no queda nada, el ticket termina como «sin cambios» y no como error.

Se agregaron 4 tests (el runner pasa de 72 a 76). Para la ejecución que falló: **Reintentar**.

## Cómo funciona hoy (punto de partida)

- Hay un clon por repo y **un worktree por ejecución y repo**, compartido por todos los agentes de esa ejecución
  (desarrollador y revisor trabajan en la misma carpeta, uno tras otro). No se vuelve a clonar; solo se hace un
  `git fetch` por trabajo.
- El runner **no corre `npm install`**: lo instala el agente cuando se le ocurre. De cinco worktrees medidos, tres
  tienen `node_modules` de 580 a 760 MB y dos no instalaron nada.
- Al publicar la PR el runner borra el worktree de esa rama (`release`), y cada vez que arranca borra los que nadie
  tocó en una semana (`sweep`). Quedan los de ejecuciones fallidas o canceladas, hasta esa semana.
- Cada agente arranca de cero y vuelve a explorar el código.

## 1. Archivos sugeridos por Lucy en cada ticket — hecho (commit `13852ee`)

Que el desarrollador no gaste lecturas buscando por dónde empezar. El prompt de `tickets` ya le pedía a Lucy decir qué
archivos toca cada ticket, pero solo dentro de la descripción.

- Campo opcional `files` en el ticket (hasta 15 rutas). Los tickets se guardan como `jsonb`: no hay migración y los
  anteriores siguen funcionando sin él.
- Se pide en el prompt de `tickets` y llega a los prompts de desarrollo y revisión como **pista, no como límite**
  («si el ticket necesita otros, léelos y cámbialos»). El panel del ticket lo muestra en «Archivos previstos».
- Los submódulos siguen vedados aunque aparezcan en la lista: el runner descarta esos cambios de todos modos.
- Tests del parser, de los prompts y del panel (servidor 571, front 540).

## 2. Diff para el revisor — cerrado sin cambios

El prompt de revisión ya le indica al revisor `git diff <commit anterior> HEAD` para ver los cambios del ticket. Pegarle
el diff entero ahorraría una llamada a una herramienta, pero obligaría al runner a calcularlo y mandarlo, y el revisor
igual tiene que leer el código de alrededor. No compensa; queda como está.

## 3. Limpieza de worktrees — cerrado sin cambios

Ya existe: `release` borra el worktree al publicar la PR y `sweep` borra los abandonados a la semana. Borrar al
cancelar necesitaría un aviso del servidor al runner para ahorrar espacio que hoy sobra (350 GB libres), y una fallida
se conserva a propósito porque se puede reintentar sobre el mismo worktree.

## 4. Comunicación en los dos sentidos entre Lucy y los agentes — notas hechas, el resto pendiente

Lucy es la coordinadora y el usuario habla solo con ella. El detalle completo está en
`etapa-2-lucy-y-los-agentes.md`.

- **Agente → Lucy: ya construido** en el servidor, con tests; falta verlo con una pregunta real. El desarrollador
  termina con `PREGUNTA: …` cuando no puede seguir y no hizo cambios; el ticket pasa a «Esperando respuesta»
  (máximo 2 preguntas por ticket). Lucy contesta `RESPUESTA:` o `ESCALAR:`; por defecto siempre escala y el usuario
  ve su recomendación (`EXECUTIONS_LUCY_ANSWERS=true` la deja contestar sola). La respuesta queda como decisión del
  ticket y el desarrollador retoma con ella; los revisores también la ven.
- **Lucy → agente: notas, hecho** (commit `e5710b6`). Los agentes solo existen mientras corre su trabajo, así que
  hablarles es dejar una **nota para su próxima vuelta** en el ticket:
  - el usuario la escribe en el panel del ticket («Notas para el agente»);
  - Lucy la propone desde su chat con una línea `NOTA <n>: …` que el servidor separa de su texto; el usuario la
    confirma con un botón «Dejar la nota» y recién ahí se guarda;
  - la nota entra al prompt del desarrollador y del revisor la próxima vez que se trabaje el ticket, incluido un
    reintento, y Lucy la ve en su contexto. No interrumpe un trabajo en curso ni se acepta en un ticket ya hecho.
  - Endpoint: `POST /executions/:id/tickets/:ticketId/notes`. Servidor 584 tests, front 548.
  - Esto es lo que habría resuelto el caso de los submódulos.
- **Sigue pendiente de la etapa 2** (no se hizo en este punto): pedirle una explicación a un agente (una llamada corta
  con su persona), el hilo de mensajes guardado en el servidor (hoy el chat vive solo en el navegador) y que los
  revisores también puedan preguntar. La etapa 3 (Lucy propone acciones y el usuario las aprueba) queda fuera.

## Estado al 2026-10-26 (tarde)

1. **Despliegue: hecho.** El servidor y el front están en `66a4bde`: instrucción nueva de Lucy (propone la nota solo al
   cerrar la conversación), aviso en su chat cuando la ejecución falla, botón «Dejar la nota y reintentar» y las dudas.
2. **Dudas sin fallo: hecho** (`66a4bde`). El desarrollador cierra su resumen con una línea `DUDAS: …` y el revisor usa un
   campo `doubts`, cuando hicieron un supuesto o algo quedó sin probar. Se guarda en el ticket (hasta 5, sin migración),
   se muestra en el panel («Dudas de los agentes») y Lucy comenta cada una nueva en su chat sin detener la ejecución,
   invitando a conversar y, si hace falta, a dejar una nota. También la ve en su contexto. Servidor 592 tests, front 555.
3. **Pendiente: probar con una ejecución real.** Reintentar la que falló por el submódulo `src/mipedido`, con una nota en el
   ticket, para ver juntos los submódulos, las notas, los archivos previstos, las dudas y el chat. No se probó nada contra
   el servidor real; todo lo anterior está verificado solo con tests.
4. **Pendiente de la etapa 2:** pedirle una explicación a un agente, hilo de mensajes guardado en el servidor, revisores que
   puedan preguntar y la etapa 3 (acciones con confirmación).

## Corregir una ejecución ya terminada (opciones, 2026-10-26)

Hoy un ticket «hecho» no se puede reabrir ni se pueden agregar tickets después de empezar: los tickets se crean una sola vez, al
dividir el plan. Si el desarrollo tiene errores, se corrigen a mano en la rama de la PR. Opciones para que lo hagan los agentes:

- **A. Reabrir un ticket con una nota.** El ticket vuelve a desarrollo y revisión con la corrección que redacta Lucy (el usuario confirma).
- **B. Agregar tickets a una ejecución** (hotfix o lo que no se consideró al inicio), en la misma rama; la PR abierta se actualiza sola.
  Requiere reabrir una ejecución completada y cambiar el paso de publicar para que, si la PR ya existe, solo suba los commits nuevos.
- **C. Revisión final automática** de toda la rama contra el plan y las recetas, que propone tickets de corrección. Es lo que ataca
  «no debo intervenir», pero necesita la base de B para aplicar las correcciones.
- **D. Chequeos del runner** (lint, build, tests) antes de abrir la PR; necesita la etapa B de las recetas.

**Actualización (2026-10-27): A, B y una forma de C se construyeron** (ver la sección siguiente). Queda para después la aprobación
automática con tope de rondas.

**Pendiente de desplegar:** `7ff7c43` (Lucy ya no propone notas para tickets hechos).

## Construido: corregir una ejecución terminada, revisión final y ramas (2026-10-27)

**A. Reabrir un ticket con una nota.** En una ejecución *completada*, un ticket «hecho» vuelve a desarrollo y revisión con la nota
del usuario (que entra al prompt del desarrollador y del revisor). La revisión parte del estado en que se reabrió, así que ve solo la
corrección, y el ticket arranca con 2 revisiones nuevas. Al terminar se sube de nuevo la misma rama: la PR abierta se actualiza y no
se abre otra. Se hace desde el panel del ticket («Reabrir el ticket con esta nota») o desde una propuesta de Lucy.

**B. Agregar tickets a una ejecución completada** (un hotfix, lo que no se consideró): hasta 5 de una vez y 15 en total. Se desarrollan y
se revisan como los demás, en la misma rama, y la PR abierta se actualiza. Los trabajadores solo se asignan a los nuevos.

**Revisión final bajo demanda** (con la ejecución completada, nunca sola): un revisor lee toda la rama contra el plan, los criterios de
los tickets y las recetas, corre `npm test/lint/build` sin editar nada y deja un informe con resumen y hallazgos (gravedad, archivo,
qué está mal, qué cambiar). El informe queda en la ejecución (columna `final_review`), no mueve su estado y, si falla, falla solo la
revisión. Cada hallazgo tiene un botón «Corregir con un ticket» (usa B). Lucy avisa en su chat cuando termina y conoce el informe.
Cubre el repositorio principal; los demás de una tarea con varios repos los lee como consulta, sin poder hacer su diff.

**Lucy propone, el usuario confirma** (nada se ejecuta solo): `NOTA <n>: …` (reabre el ticket si está hecho y la ejecución completada),
`TICKET <nivel> | título | descripción [| repo]` y `REVISION FINAL`, cada una como una tarjeta con su botón en el chat.

**Runner:** nuevo tipo de trabajo `final`, que se comporta como una revisión (herramientas de solo lectura más `npm test/lint/build`,
descarta lo que deje, tiempo de 25 minutos). Al retomar una rama ya publicada, si el clon no la tiene se parte de la del remoto y no
de la base, y si alguien le sumó commits a mano (una corrección en la PR) el worktree se adelanta a ellos para que el push no sea rechazado.

**Nombres de rama:** ya no `workbench/<tarea>-<id>`. Ahora `feature|fix|hotfix/<tarea>` y, si la tarea viene de Plane (no es local),
`feature/MEL-12/<tarea>` con el código de su ticket (clave del proyecto + número). El tipo se deduce del título de la tarea (palabras como
*hotfix*, *fix*, *bug*, *corregir*, *arreglar*, *falla*; en otro caso *feature*) y se puede forzar con `branchType` al ejecutar (la app
todavía no tiene un selector). Si la tarea ya tuvo ejecuciones, la rama lleva `-2`, `-3`… porque la anterior sigue en el remoto con su PR.

**Todavía no hay:** un selector del tipo de rama en la app, la revisión final de varios repositorios con diff de cada uno, ni la aprobación
automática de correcciones con tope de rondas. Servidor 705 tests, front 626, runner 83.
