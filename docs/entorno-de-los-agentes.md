# Entorno de los agentes: que puedan levantar proyectos y probar de verdad

Plan acordado en conversación el 2026-10-27, **solo planificación: no hay nada construido todavía** (salvo lo que dice «Estado de tu PC»).

## Por qué

Los agentes de las ejecuciones no pueden probar lo que hacen. El caso que lo mostró: en miflota-web, el revisor no pudo correr `nginx -t`
ni un `curl`, porque no tiene permiso para esos comandos y porque nadie levanta el proyecto (Nginx, la base de datos y la app viven en
contenedores). Dejó la duda y la prueba quedó para staging. Las recetas (etapa A) les dicen **cómo** se prueba cada proyecto, pero nada lo ejecuta.

**Objetivo:** que un agente pueda trabajar casi como un desarrollador **en entorno local**: Docker, comandos dentro de los contenedores, `curl`,
crear y modificar archivos, y elegir otros puertos si los suyos están ocupados. Limitado a su carpeta de trabajo y **sin ningún acceso a producción**.

## Decisiones

**Decidido**
- El agente solo administra **sus propios** contenedores, nunca los tuyos (por ejemplo tu `miflota-db` en el puerto 3307).
- Cada ejecución recibe un **rango de puertos propio** y un **nombre de proyecto de Docker único** (`wb-<id de la ejecución>`); la receta dice qué
  variables cambiar (`COMPOSE_PORT` y similares).
- Al terminar, fallar o cancelar, **el runner borra todo** lo de esa ejecución (contenedores, redes, volúmenes).
- **El entorno es opcional y bajo demanda**: no todas las tareas necesitan un proyecto levantado, así que arranca apagado.
- El entorno es **de la ejecución, no del agente**: se levanta una vez y lo comparten el desarrollador, el revisor y los tickets siguientes.
  Un cambio de código se ve de inmediato (el contenedor monta el worktree); migraciones, caché y reinicios los hace quien los necesite.

- **Todo vive dentro de la distro** (decidido el 2026-10-27): los clones, los worktrees y el trabajo de los agentes están en el disco propio de `wb-agents`,
  no en `E:\`. Se descarta traer la rama a Windows con `git fetch` para subirla; el runner trabajará dentro de la distro (ver «Consecuencias»).
- **Riesgo de red asumido** (2026-10-27): desde la distro se alcanzan los puertos 3307 y 5432 de Windows (las bases de datos que publican tus contenedores).
  Se deja como está. Si cambia el contexto (más gente, datos reales en esas bases), se vuelve a evaluar con las alternativas de abajo.

**Propuesto, a confirmar**
- **Aislar a los agentes en una distro de WSL aparte** (`wb-agents`), con su propio Docker, sin tus llaves SSH y viendo solo la carpeta de trabajo.
  La alternativa (correr como tú, con reglas de comandos y flags prohibidos) es más rápida de armar pero su seguridad depende de que ninguna regla falle.
- **El runner levanta el entorno** con comandos que tú defines por proyecto; el agente lo usa (pruebas, migraciones, `curl`, reiniciar un servicio).
  El agente nunca levanta el stack completo por su cuenta ni usa un `docker` libre.
- **Lucy marca por ticket si necesita entorno**, tú lo ajustas en la pantalla de visto bueno, y el agente puede pedirlo a mitad de ticket (con un tope).
- **Qué proyectos se levantan:** las etiquetas de la tarea dicen cuáles intervienen (corren con la rama de la ejecución) y «Depende de» de la receta
  dice cuáles hay que tener corriendo sin modificarlos (corren con su rama principal).
- **Docker de los agentes:** el instalado dentro de su distro. Docker Desktop queda para ti.

**Abierto**
- ¿El revisor también recibe el entorno (sin poder editar archivos)? Mi sugerencia: sí, solo si el ticket lo tiene encendido.
- Tope de gasto y de tiempo para los trabajos con entorno: no tocarlo hasta medir con la pantalla Consumo.
- ~~Dónde viven los worktrees~~ **Resuelto por la prueba: dentro de la distro**, en su disco propio (ver el resultado de la etapa 1).

## Etapas

Cada etapa se puede usar sola y termina con algo comprobable. No se pasa a la siguiente sin cerrar la anterior.

### Etapa 1: la distro aislada (prueba chica)

Crear el entorno donde correrán los agentes y comprobar que se puede trabajar ahí, **sin cambiar todavía cómo trabaja el runner**.

- Configurar `/etc/wsl.conf` de `wb-agents`: `systemd` activo, `automount` e `interop` desactivados (no ve tus discos ni corre programas de Windows).
- Usuario normal sin llaves SSH ni credenciales tuyas. El runner, que sí las tiene, sigue clonando y subiendo desde Windows.
- Montar **solo** `E:\workbench-agent-repos` dentro de la distro.
- Instalar Docker Engine dentro de la distro. No activar la integración de Docker Desktop para ella.
- Iniciar sesión del CLI de Claude dentro de la distro (con tu misma cuenta) y correr **un** agente de prueba.
- Medir: velocidad de `npm install` y `composer install` sobre la carpeta montada frente al disco propio de la distro; memoria usada.
- Por verificar antes de prometerlo: que el CLI se pueda autenticar y correr en la distro, y qué aísla realmente el modo sandbox de Claude Code ahí.

**Hecha cuando:** desde la distro, el agente de prueba edita un archivo del worktree, corre `docker run hello-world`, y **no** puede ver `C:\`,
tu Ubuntu ni tus llaves.

**Resultado de la prueba (2026-10-27).** La distro `wb-agents` quedó creada y configurada. Lo que se hizo y lo que se midió:

- **Hecho:** Ubuntu 24.04 limpia en `E:\wsl\wb-agents`; usuario `agent` sin sudo y sin llaves; `systemd` activo; discos de Windows y programas de
  Windows desactivados (`automount` e `interop`); `E:\workbench-agent-repos` montada como `/work` (escribible); Docker Engine 29.1.3 con Compose 2.40.3
  (el usuario `agent` corre contenedores); git 2.43, curl, build-essential, unzip, jq; nvm 0.40.1 con Node 24 LTS; CLI de Claude 2.1.310. Docker Desktop y
  tu Ubuntu siguen igual: tus 5 contenedores no se reiniciaron en ningún momento.
- **Aislamiento comprobado:** el agente no ve `C:`, `D:` ni `E:` (0 entradas), ni tus llaves, ni tu Ubuntu; solo ve `/work`.
- **Fuga encontrada y cerrada:** `/mnt/wsl` es compartido entre distros y Docker Desktop publica ahí los **sockets de su Docker** y las **carpetas de tus
  proyectos** (`/root/git_repos/…`, en lectura y escritura). Se cerró con el servicio `wb-isolate` (arranca antes que Docker): deja de compartir `/mnt/wsl`
  en esta distro, desmonta todo eso y tapa las carpetas. Se probó antes con una carpeta inocua que el cambio **no** se propaga a tus otras distros.
- **Red compartida:** todas las distros de WSL2 usan la misma red. Docker reparte por defecto subredes 172.16–172.31 y WSL usa 172.20.160.0/20, así que se
  fijaron rangos propios en `/etc/docker/daemon.json` (puente `10.199.0.0/24`, redes nuevas desde `10.200.0.0/16`).

**Hallazgos que cambian el diseño:**

1. **Los worktrees tienen que vivir dentro de la distro.** Medido sobre `/work` (carpeta de Windows vista por 9p) frente al disco propio de la distro, con un repo
   chico y sin `node_modules`: recorrer 709 archivos 0,63 s frente a 0,005 s, y `git status` 4,2 s frente a 0,015 s (unas 280 veces más lento).
   Con dependencias instaladas sería inusable.
2. **`git` no funciona sobre un worktree creado por Windows.** Su `.git` dice `gitdir: E:/workbench-agent-repos/…` y Linux lo resuelve como ruta relativa
   («not a git repository»). Cada worktree debe crearse y usarse con el mismo git. Esto afecta al revisor, que usa `git diff`.
3. **Consecuencia, y diseño propuesto:** el clon autoritativo y las llaves siguen en Windows. El runner crea el clon de trabajo **dentro de la distro**
   (`git clone` local desde el clon de Windows, sin red ni llaves), el agente trabaja ahí, y al terminar el runner trae la rama a su clon de Windows con
   `git fetch` desde la distro y la sube con sus llaves. Hay que probarlo en la etapa 2.
4. **La red es un riesgo abierto: desde la distro se alcanzan los puertos 3307 y 5432 de tu Windows**, las bases de datos que publican tus contenedores
   `databases-mimixer-db` y `databases-postgis-db`. Hace falta credencial, pero es una vía que no debería existir. Cerrarla con reglas de `iptables` (por usuario y
   por subred de los contenedores del agente) es posible pero **afecta a una red compartida** con tu Ubuntu, y quien tenga el grupo `docker` en la distro podría
   quitarlas. Las alternativas son el firewall de Hyper-V para WSL (afecta a todas tus distros) o una máquina virtual aparte. **Decisión pendiente.**

### Consecuencias de que todo viva en la distro

Esto reemplaza el diseño del hallazgo 3 (clon autoritativo en Windows). Lo que implica, y lo que hay que decidir:

1. **Las credenciales de Bitbucket pasan a estar dentro de la distro.** El runner necesita clonar y subir ramas. Quien tenga el grupo `docker` en la distro
   (el agente) puede leer cualquier archivo de ella, así que lo que se ponga ahí queda al alcance del agente. Por eso **no** se copian tus llaves SSH personales:
   se usa una credencial **propia de este uso y acotada** (un token de acceso por repositorio con permiso de escritura, por HTTPS; o una cuenta de servicio con
   su propia llave), y se protege la rama principal de cada repo para que solo se pueda cambiar por PR. La PR la sigue abriendo el servidor, no el runner.
2. **El runner se muda a la distro** (propuesto): corre allá con su configuración, su `runner.lock`, su registro y Node 24, y el agente corre como otro usuario.
   El mismo código sirve en Linux; hay que revisar `windows.ts` (arranque automático) y las pruebas.
3. **La distro tiene que estar encendida para que haya runner.** Un servicio de `systemd` en la distro arranca el runner, y una tarea de Windows enciende la
   distro al iniciar sesión. El botón «Ejecutar» de la app, que hoy abre el runner con el enlace `workbench-runner://`, tendría que encender la distro.
4. **Dos runners durante la transición.** El de Windows (sin entorno) puede seguir sirviendo mientras tanto; la app ya admite varios runners y uno por defecto.
5. **Ver el trabajo desde Windows sigue siendo posible**: la distro se abre como carpeta de red (`\\wsl.localhost\wb-agents\…`) y desde el editor con la extensión
   de WSL. Las carpetas viejas de `E:\workbench-agent-repos` dejan de usarse para ejecuciones nuevas.
6. **El disco de la distro crece** (un solo archivo `.vhdx` en `E:\wsl\wb-agents`) y no se encoge solo; la limpieza de worktrees viejos pasa a importar más.

**A decidir antes de la etapa 2:** (a) qué tipo de credencial de Bitbucket, (b) si el runner se muda a la distro, (c) si conviven los dos runners.

**Falta de esta etapa:** iniciar sesión del CLI de Claude dentro de la distro (necesita tu navegador) y correr el agente de prueba.

### Etapa 2: un proyecto de punta a punta (miflota-web)

El runner levanta el entorno de **un** proyecto y el agente lo usa.

- Configuración por proyecto en `runner.config.json`, por ejemplo `environments["garage-labs/miflota-web"]`: archivos de compose, variable de puerto,
  servicios fuera del compose (la base de datos), pasos de preparación (`composer install`, esquema, fixtures) y archivos locales a copiar.
- El runner asigna puertos y nombre único, levanta, espera a que responda y le dice al agente en su prompt cómo está («arriba, en estos puertos»).
- El agente puede correr, **solo sobre su entorno**: comandos dentro de los contenedores, `docker compose` de su stack, `curl`, pruebas, migraciones.
- Al terminar la ejecución, el runner baja y borra todo.

**Hecha cuando:** Pilar, en una ejecución real de miflota-web, valida con `nginx -t` y `curl` que `/secured/admin/ea` deja pasar un multipart y otra ruta
da 415, y al terminar no queda ningún contenedor ni volumen de esa ejecución.

### Etapa 3: bajo demanda

- Campo nuevo en el ticket: «necesita entorno». Lucy lo marca al dividir el plan, viendo qué proyectos tienen entorno configurado; no puede pedir uno que no existe.
- La pantalla de visto bueno muestra «entorno: sí/no» por ticket para que lo cambies.
- Comando para que el agente pida el entorno de su repositorio (o de una dependencia declarada) a mitad de ticket; el runner rechaza cualquier otro. Con un tope de
  levantamientos por ejecución.
- Si ningún ticket lo necesita, nunca se levanta.

**Hecha cuando:** una ejecución con un ticket de solo texto no levanta nada, y otra con un ticket que sí lo necesita lo levanta una sola vez para todos sus tickets.

### Etapa 4: varios proyectos a la vez

- Las **etiquetas** de la tarea dicen qué proyectos intervienen. Cada uno corre con la rama de la ejecución.
- **«Depende de»** (receta) dice qué más hay que tener corriendo sin modificarlo; corre con su rama principal. Hasta 2 niveles, sin ciclos.
- Orden: primero las dependencias; el runner espera a que respondan y le pasa a cada proyecto dónde están las demás (por puerto del host y
  `host.docker.internal`; cada proyecto lee esa dirección de una variable distinta, y la configuración lo dice).
- Lucy decide por ticket cuáles de los candidatos hacen falta. Por defecto: el repositorio del ticket más sus dependencias declaradas.
- Si una dependencia no tiene entorno configurado, el proyecto se levanta sin ella y el agente lo sabe.
- **A verificar antes:** una etiqueta significa «se modifica» (rama y PR). Hay que comprobar qué hace hoy el paso de publicar con un repositorio etiquetado sin
  cambios; probablemente falla al abrir una PR vacía.

**Hecha cuando:** una tarea que cambia `miseguridad-ionic` y necesita `miseguridad-web` corriendo puede iniciar sesión de punta a punta en una ejecución real.

### Etapa 5: más proyectos y menos trabajo manual

- Repetir la configuración con los demás proyectos, de uno en uno, probando cada uno.
- Opcional: **«generar borrador con IA»** de la configuración (un agente lee el `docker-compose.yml` y el README y propone; tú corriges).
- Cuando el aislamiento de la etapa 1 funcione, evaluar mover la configuración **dentro de la receta** (un solo lugar para editar en la app). Antes no: quien
  pudiera editar recetas haría ejecutar comandos en tu máquina.

## Riesgos y límites

- Un agente con shell y Docker libres puede salirse de su carpeta (montar todo el disco, leer tus llaves). Por eso el aislamiento es la etapa 1 y no un extra.
- Todas las distros de WSL2 comparten una sola máquina virtual y un solo tope de memoria: los contenedores de los agentes y los tuyos compiten.
- Cada proyecto exige su propia configuración probada. No existe un «levantar cualquier proyecto» general.
- Levantar el entorno suma minutos a la ejecución (sobre todo la base de datos y la preparación), y el que lo levanta primero paga esa espera.
- Lo que un agente migra o carga en la base queda hasta que termine la ejecución: el siguiente parte de ese estado.
- Una IA que revisa a otra puede dejar pasar errores aunque pueda probar. Tener entorno reduce las dudas sin probar, no las elimina.

## Estado de tu PC

Distro `wb-agents` instalada y configurada (ver el resultado de la etapa 1), en `E:\wsl\wb-agents`. Cambios fuera de ella: ninguno en tu Ubuntu, en Docker
Desktop ni en el runner. Si no se sigue por este camino, se quita con `wsl --unregister wb-agents` y borrando esa carpeta.
## Lo que ya existe y se reutiliza

- Recetas de proyectos (etapa A): texto por repositorio con «Depende de», que ya llega a los prompts de Lucy, el desarrollador y el revisor.
- Etiquetas de las tareas con el enlace de su repositorio, que ya definen los repositorios de una ejecución.
- Ejecuciones con varios repositorios (una rama y una PR por cada uno) y sus worktrees por ejecución.
- Pantalla de visto bueno donde se reasignan los trabajadores de cada ticket.
- Revisión final, reabrir tickets y sumar tickets a una ejecución terminada.
- `copyFiles` del runner, que ya copia archivos locales (como un `environment.ts`) a un worktree nuevo.
