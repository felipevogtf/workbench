`# Recetas de proyectos
`
`Idea acordada el 2026-10-25. **Estado al 2026-10-26: la etapa A está construida (servidor y front); falta desplegarla,
`probarla con una ejecución real y la etapa B.**
`
`## Estado
`
`**Hecho y probado con tests (servidor 629, front 584):**
`- Módulo \`recipes\` en el servidor: una receta por repositorio (\`organización/repo\`, único) con su texto en Markdown
`  (hasta 20.000 caracteres) y los repositorios de los que depende (hasta 10, sin sí mismo). CRUD en \`/recipes\`, tabla
`  \`project_recipes\` (migración \`1794000000000-ProjectRecipes\`).
`- Contexto para los agentes: la receta del repo y, debajo, la de cada dependencia marcada como «repositorio del que
`  depende X». Hasta 2 niveles, cada receta una sola vez (los ciclos no se repiten), 6.000 caracteres por receta, y un
`  aviso si una dependencia no tiene receta. Se agrega a los prompts de quien crea los tickets, del desarrollador y del
`  revisor, incluyendo los repos de consulta de una tarea con varios repos. Si no se pueden leer, el trabajo sigue sin ellas.
`- Menú **Automatización → Recetas** (\`/executions/recipes\`): lista con extracto, dependencias y fecha; diálogo para crear
`  o editar con una plantilla de partida (levantar, base de datos, probar, no tocar), vista previa del Markdown y
`  «Depende de» con sugerencias; el repositorio no se cambia al editar; borrar pide confirmación.
`
`**Falta de la etapa A:**
`- Enlaces entre recetas (\`[[miseguridad-web]]\`) clicables en el editor.
`- El botón opcional «Generar borrador con IA».
`- La receta en el chat de Lucy de la ejecución (hoy solo la reciben los agentes que trabajan).
`- Escribir las recetas reales, empezando por el repositorio del que otros dependen (la web antes que la app).
`
`**La etapa B** (que el runner levante Docker y el agente corra pruebas dentro) sigue sin construirse. Hasta entonces los
`agentes saben cómo se prueba cada proyecto por la receta, pero no pueden ejecutarlo: un revisor de un proyecto PHP sigue sin
`poder correr \`nginx -t\` ni \`phpunit\`.
`
`## El problema
`
`Cada proyecto se levanta a su manera: algunos con su `docker-compose.yml` y overrides, cada web con su versión
`de PHP en un contenedor, y la base de datos en otro contenedor que se llena de formas distintas (fixtures,
`migraciones o comandos propios para poblar). Además hay proyectos que dependen de otros: la app necesita la
`web levantada para iniciar sesión. Hoy los agentes no saben nada de eso.
`
`No hay una forma general de adivinarlo, así que cada proyecto necesita **su receta**, escrita una vez.
`
`## Qué es una receta
`
`Un texto con formato (Markdown) por repositorio que explica cómo se levanta y se prueba ese proyecto:
`
`- qué compose y overrides usar, y qué puertos ocupa;
`- cómo se llena la base de datos (migraciones, fixtures o el comando que corresponda);
`- cómo se corren los tests y el linter;
`- qué cosas no hay que tocar;
`- de qué otros repositorios depende (ver más abajo).
`
`## Etapa A: el menú «Recetas» (lo que se hará primero)
`
`En la app, *Automatización → Recetas*:
`
`1. **Tabla de recetas** en el servidor: repositorio (`organización/repo`, único), contenido en Markdown,
`   «depende de» (lista de repositorios) y fecha de edición.
`2. **Pantalla:** lista de repositorios y un editor con vista previa. Los enlaces a otras recetas
`   (`[[miseguridad-web]]`) son clicables.
`3. **Campo «Depende de»:** otros repositorios cuya receta hace falta para probar este. Ejemplo: la receta de
`   `miseguridad-ionic` depende de `miseguridad-web`.
`4. **Contexto para los agentes:** la receta del repo se agrega a los prompts de Lucy, David y los revisores,
`   igual que `REVIEW_RULES.md`. Debajo va la receta de cada dependencia, marcada como «repositorio del que
`   depende».
`   - Hasta **2 niveles** de dependencias y con un **tope de tamaño** por receta (se recorta).
`   - Cada receta se incluye **una sola vez** (si hay un ciclo, no se repite).
`   - Si una dependencia no tiene receta escrita, el agente recibe solo un aviso de que falta.
`   - Escribir primero la receta del repo del que otros dependen (la web antes que la app).
`5. **Opcional, al final:** botón «Generar borrador con IA». Un agente lee el compose, el README y los scripts del
`   repo y propone la receta; se corrige a mano. Se decide después de ver funcionar lo anterior.
`
`Con esto los agentes saben cómo se prueba cada proyecto aunque todavía no puedan ejecutarlo.
`
`## Etapa B: ejecutar el entorno de verdad (después, repo por repo)
`
`Que el runner levante los contenedores y el agente corra tests dentro de ellos. Va **aparte, en
``runner.config.json` y no en la app**: el servidor ya manda trabajos al runner, pero hoy no puede hacerle
`ejecutar comandos arbitrarios porque quien decide qué herramientas existen es la configuración local. Si las
`recetas ejecutables vivieran en el servidor, cualquiera que pudiera editarlas podría hacer correr comandos en el
`PC. La receta de texto de la etapa A sirve de guía para escribir esa configuración.
`
`Una configuración por repo con:
`
`- **levantar:** el comando exacto, con los archivos de override, y un nombre de proyecto de Docker único por
`  ejecución (por ejemplo `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d`);
`- **preparar la base de datos:** los comandos propios de ese repo;
`- **qué puede correr el agente dentro del contenedor:** `phpunit`, el linter y poco más (nunca un `docker exec`
`  libre);
`- **apagar:** el comando de bajada, que también borra los datos de esa ejecución.
`
`El campo «Depende de» de la etapa A serviría aquí para que el runner levante primero el entorno de la web
`antes de probar la app.
`
`### Riesgos a resolver en la etapa B
`
`- **Qué carpeta monta el contenedor:** cada ejecución trabaja en su propio worktree, no en el clon de siempre.
`  El contenedor tiene que montar ese worktree, o el agente probaría otro código.
`- **Choques con el entorno de siempre:** puertos fijos y nombres de contenedor. Hace falta un nombre de
`  proyecto distinto, puertos libres, o detener los contenedores propios mientras corre la ejecución.
`- **La base de datos** es lo que más tiempo toma crear y poblar en cada ejecución.
`- **Seguridad:** `docker exec` da acceso amplio; por eso solo comandos concretos y definidos en el runner.
`- **Tiempo:** levantar el entorno suma minutos a cada ejecución.
`
`Empezar por `miseguridad-web`, que es el que necesita la primera tarea con dos repos.
`
`## Relación con las tareas de varios repos
`
`Ya está hecha la **fase 1** (una tarea con varios repos: una rama y una PR en cada uno, con los demás repos
`abiertos para leer). Las recetas la complementan: cuando una tarea toca solo la app, la receta de la web llega
`como contexto aunque ese repo no esté en la tarea.
