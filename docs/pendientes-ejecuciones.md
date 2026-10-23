# Pendientes de las ejecuciones con IA

Estado al pausar. Rama: `feat/task-executions`. El plan de fondo está en `ejecucion-de-tareas-con-ia.md`.

## Hecho y probado en local, pero SIN subir ni desplegar

Último arreglo (tras la ejecución fallida de «HU 1 - MiObra», ticket «Incorporar tipografía Space Grotesk»):

- **Causa:** en la segunda vuelta el revisor pidió `npm i …` y `ng build`, y el desarrollador no podía:
  `npm install` no estaba en sus herramientas. Hizo bien en no inventar nada, pero la ejecución falló con
  «no hizo cambios» y la pantalla dejó «Revisión» girando.
- **Arreglos (servidor, runner y front):**
  1. El desarrollador ahora puede `npm install`, `npm i` y `npm ci` (servidor `MODULE_TOOLS`, espejo del front,
     valores por defecto del runner, y una migración que actualiza el agente `default-task-developer` si nadie
     le cambió las herramientas: `1793100000000-DeveloperInstallTools`).
  2. El error de «sin cambios» ahora incluye la explicación del desarrollador, y se guarda en el ticket.
  3. Una ejecución que falla ya no deja etapas «corriendo» (no gira para siempre).
  4. **Reintentar reconstruye el trabajo con los agentes actuales** (antes copiaba el viejo, con las
     herramientas y el prompt de antes).
  5. Prompts: el desarrollador instala dependencias si faltan y no se detiene por un comando denegado; el
     revisor pide solo lo que se puede hacer editando o con npm, sin comprobaciones manuales (DevTools…).
- **Pruebas:** servidor 489, runner 57, front 401, todo en verde. Lint y build bien.

## Para dejarlo funcionando (en este orden)

1. **Subir y desplegar** (la rama no está empujada con estos cambios):
   ```
   git push
   ssh personal_server 'cd ~/git_repos/workbench && git pull && cd deploy/prod && docker compose up -d --build'
   ```
   La migración corre sola al arrancar el servidor.
2. **En tu PC, reconstruir y reiniciar el runner** (las herramientas por defecto cambiaron):
   ```
   cd workbench-runner
   npm run build
   ```
   y reiniciarlo: cerrar sesión de Windows y volver a entrar, o terminar el proceso `node` del runner y
   pulsar «Ejecutar» (la app lo abre sola).
3. **Reintentar** la ejecución fallida desde su página (botón «Reintentar»). Ya usará las herramientas nuevas.
   Si el desarrollador sigue sin poder instalar, mirar `workbench-runner\runner.log` y el registro del trabajo.

## Pendiente de verificar o decidir

- **Abrir una PR real en Bitbucket.** Nunca se probó con un repo de verdad (el token sí tiene permiso: se
  comprobó con una rama inexistente). Hay que elegir un repo, dejar que suba una rama `workbench/…`, ver la PR
  y cerrarla.
- **Revisor de la PR:** Bitbucket no deja asignar al autor (dueño del token). La PR sale sin revisor salvo que
  se ponga `EXECUTIONS_PR_REVIEWERS` en `server.env` con uuids de otras cuentas.
- **Merge a `main`:** el servidor sigue corriendo `feat/task-executions`, no `main`. Decidir cuándo mergear.
- **`npm install` da a un agente código de terceros en tu PC** (scripts de instalación de los paquetes). Está
  explicado en el README del runner, con cómo quitarlo en `runner.config.json` si no se quiere.
- **El revisor puede seguir pidiendo cosas imposibles** (probar en un navegador, etc.). El prompt ya lo
  desaconseja, pero conviene mirar las primeras ejecuciones reales y ajustar los prompts de los trabajadores
  (se editan en *Automatización → Trabajadores*).
- **Reinicio de Windows:** el arranque automático solo funciona al **iniciar sesión**, no antes. Comprobarlo
  de verdad una vez (reiniciar, entrar y mirar que «Mi PC» diga Conectado).

## Limpieza que quedó pendiente

- Carpeta `C:\wbt` (repo y carpeta de trabajo de mis pruebas): se puede borrar. Un chequeo de seguridad me
  impidió borrarla.
- En el servidor no quedan datos de prueba (se borraron tarea, etiqueta, proyecto y runners `zz-…`).
- El runner «Mi PC» es el tuyo: no tocarlo.

## Ideas para después (ya hablado)

- **Fase 1b:** varios tickets en paralelo (un worktree por ticket), pausas de aprobación (tras crear tickets y
  antes de la PR) con edición de tickets, interruptores por etapa (por ejemplo apagar la revisión), límites
  de paralelismo y vueltas configurables.
- **Fase 2:** editor del flujo, varios desarrolladores, delegación a modelos más baratos, plantillas.
- **Personalidad de los trabajadores** (los agentes de la automatización): se dejó el espacio, falta definirla.
- **GitHub** como segundo proveedor de PRs (hoy solo Bitbucket).
- **`chat-panel.scss`** supera el presupuesto de tamaño de Angular (4 kB, avisa pero no falla); se puede
  subir el presupuesto o recortar estilos.

## Cosas a recordar

- Una vez usé `taskkill /IM node.exe`, que mata todos los procesos node del PC. No repetir; matar por PID.
- Los heredocs largos de Bash fallan en este entorno: para parchear archivos, escribir un script con la
  herramienta Write y ejecutarlo.
- Para ver el estado de una ejecución sin tocar la base de datos, usar la API:
  `GET /api/issues/:id/executions`, `GET /api/executions/:id` y `GET /api/executions/jobs/:jobId/logs`.
