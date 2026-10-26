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
