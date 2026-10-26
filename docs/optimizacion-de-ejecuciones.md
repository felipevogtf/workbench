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
- El runner ya borra los worktrees que nadie tocó en una semana; los de ejecuciones cerradas se quedan hasta entonces.
- Cada agente arranca de cero y vuelve a explorar el código.

## 1. Archivos sugeridos por Lucy en cada ticket (servidor)

Que el desarrollador no gaste lecturas buscando por dónde empezar.

- Campo opcional `files` en el ticket: migración, entidad de dominio, DTO y parser de `json-output.ts`.
- Se pide en el prompt de `tickets` y se inyecta en los de desarrollo y revisión como **pista, no como límite**:
  «empieza por estos archivos; si necesitas otros, léelos».
- Los submódulos siguen vedados aunque aparezcan en la lista.
- Tests del parser, de los prompts y del servicio.

## 2. Diff para el revisor (servidor y runner)

- Primero se verifica qué recibe hoy el prompt de revisión (`prompts.ts`, `executions.service.ts`).
- Si no incluye el diff, el runner lo calcula entre `headBefore` y `headAfter` y lo manda con el trabajo de
  revisión, con un tope de tamaño para no desbordar el prompt.
- Si ya lo incluye, este punto se cierra sin cambios.

## 3. Limpieza de worktrees (runner)

- Hoy la limpieza solo borra lo que lleva una semana sin tocarse. Se añade borrar el worktree de una ejecución
  apenas termina (completada o cancelada), reutilizando esa misma limpieza. Una fallida se conserva, porque se puede
  reintentar sobre el mismo worktree.
- Es seguro porque la rama ya está subida.
- Tests: se borra el worktree de una ejecución cerrada y se conserva el de una activa.

## 4. Comunicación en los dos sentidos entre Lucy y los agentes (servidor y front, al final)

Lucy es la coordinadora y el usuario habla solo con ella. El detalle completo está en
`etapa-2-lucy-y-los-agentes.md`.

- **Agente → Lucy: ya construido** en el servidor, con tests; falta verlo con una pregunta real. El desarrollador
  termina con `PREGUNTA: …` cuando no puede seguir y no hizo cambios; el ticket pasa a «Esperando respuesta»
  (máximo 2 preguntas por ticket). Lucy contesta `RESPUESTA:` o `ESCALAR:`; por defecto siempre escala y el usuario
  ve su recomendación (`EXECUTIONS_LUCY_ANSWERS=true` la deja contestar sola). La respuesta queda como decisión del
  ticket y el desarrollador retoma con ella; los revisores también la ven.
- **Lucy → agente: lo que se construye en este punto.** Los agentes solo existen mientras corre su trabajo, así que
  hablarles es dejar una **nota para su próxima vuelta** en un ticket (Lucy la propone desde su chat y el usuario
  confirma; se guarda como decisión y entra al prompt del agente) o **pedirles una explicación** (una llamada corta
  con su persona). Esto es lo que habría resuelto el caso de los submódulos.
- **También entra aquí lo que falta de la etapa 2:** el hilo de mensajes guardado en el servidor (hoy el chat vive
  solo en el navegador) y que los revisores también puedan preguntar. La etapa 3 (Lucy propone acciones y el usuario
  las aprueba) queda fuera.
