# Optimización de tiempos de las ejecuciones

Acordado el 2026-10-27. Objetivo: que la IA responda más rápido, que los repos se revisen más rápido y que los entornos se levanten más rápido.
Primero se midió y se quitó lo evidente; lo que sigue queda como mejora hasta probar con ejecuciones reales.

## Punto de partida (últimos 14 días, trabajos terminados)

| Trabajo | Veces | Espera en cola | Duración media | Máximo |
|---|---|---|---|---|
| Desarrollo | 58 | 19 s | 109 s | 464 s |
| Tickets (Lucy) | 15 | 11 s | 83 s | 261 s |
| Chat con Lucy | 6 | 1 s | 70 s | 125 s |
| Revisión | 55 | 18 s | 27 s | 91 s |
| Publicar | 18 | 11 s | 13 s | 16 s |

Una ejecución de 5 tickets son unos 15 trabajos seguidos, de a uno. El chat de Lucy tarda 70 s con solo 1 s de espera: el tiempo es
armar el entorno en frío, no la IA.

## Hecho (en el runner)

1. **Medición.** Cada trabajo termina con una línea en su registro: `⏱ 102.5 s en total: carpeta 2.5 s · repos de consulta 1.0 s ·
   entorno 12.0 s · IA 85.0 s · limpieza 1.5 s · cierre 0.2 s` (`stopwatch.ts`, `jobs.ts`). Sirve para ver dónde se va el tiempo antes de
   optimizar más.
2. **Esperas entre trabajos.**
   - `git fetch` solo al armar una carpeta de trabajo nueva: antes iba a Bitbucket en cada trabajo, aunque la rama ya tuviera su carpeta.
   - El `chown` que devuelve al runner los archivos que crean los contenedores ahora mira primero con `find` si hay algo ajeno; solo si lo
     hay levanta el contenedor. Antes lo hacía siempre, recorriendo `node_modules` entero.
3. **Chat de Lucy sobre una ejecución terminada.** Deja armados la carpeta y el entorno al contestar, así la siguiente pregunta llega a algo
   listo. El barrido de entornos inactivos los baja a las 2 h (`idleMinutes`); las carpetas quedan hasta el barrido semanal, como las de las
   ejecuciones fallidas. Costo: disco y memoria un rato más.

## Medición real: la ejecución `6aa948cf…` (2026-10-27, sin PR, sin caché ni CodeGraph)

776 s en total, 11 trabajos, espera en cola 0 s en todos. Por fase: IA ~450 s (58%), entorno ~233 s (30%), el resto ~90 s (12%).

- **Entorno:** el primer trabajo (los tickets de Lucy) pagó 85 s. Los otros 8 con entorno pagaron **17 a 20 s cada uno** aunque ya estaba
  arriba: al empezar cada trabajo `refresh` hace `docker compose restart` de todos los servicios y espera a que respondan. Suma ~145 s,
  más que el `composer install`.
- **Pasos del entorno de `melon-web`** (calentamiento aparte, 88 s): `compose up` 4.8 s, `composer install` 24.9 s, `doctrine:schema:update`
  11.6 + 10.2 s (normal y test), `restart app` 13.4 s, espera 6.2 s. Composer es solo ~25 s de 88.

## Hecho después de la medición (2026-10-27)

- **Caché de `vendor/` activada para `melon-web`** (`dependencyCache` en la configuración de la distro) y sembrada con un calentamiento: 328 MB en
  `deps/garage-labs_melon-web/vendor`. Solo se guarda desde una rama cuyo `composer.lock` sea el de la rama base. Se espera que ahorre ~20 s en
  el primer trabajo de cada ejecución. Falta comprobarlo con una ejecución real.
- **CodeGraph** activo en `melon-web` y `melon-ionic` (ver [codegraph.md](codegraph.md)).
- **Pendiente, a propósito:** no reiniciar los servicios en cada trabajo cuando el worktree no cambió desde el último reinicio (~70 s menos por
  ejecución). Hay que confirmar que PHP no necesita el reinicio para ver cambios de código (su `opcache`).
- Otras mejoras posibles del entorno: el esquema de la base de datos (22 s) y el `restart app` + espera (~20 s) del primer arranque.

## Segunda ronda (2026-10-27, noche)

- **Caché de `vendor/`: arreglada.** Copiarla antes de `compose up` hacía que la imagen se reconstruyera (el Dockerfile hace `COPY . /app`):
  `compose up` pasó de 4.8 s a 33.6 s y el ahorro de `composer install` (25 s → 0.2 s) se perdía. Ahora se copia después de levantar. En el
  trabajo de Lucy el entorno bajó a **60 s** (antes 85–90 s) y el trabajo entero a 143 s (antes 183 s).
- **Reinicio entre trabajos: solo si algo cambió.** Al terminar un reinicio se guarda una huella del worktree (commit, estado y contenido de
  lo no guardado); el siguiente trabajo la compara y, si es igual, se salta el `docker compose restart`. Se comprobó que la imagen de
  `melon-web` no tiene `opcache` (PHP ve los cambios de código sin reiniciar). Los archivos montados sueltos que se editan en el lugar
  (`nginx.conf`) son del repo, así que su cambio altera la huella y sí reinicia. Ahorro esperado: unos 70 s por ejecución (4 de 8
  reinicios). Falta medirlo con una ejecución completa.
- **Ejecución `97ec4f02…` (caché con el orden malo, CodeGraph sin usar):** 675 s en total contra 776 s de la base.

## Tercera ronda (2026-10-28)

- **Reinicio solo si cambió configuración** (`restartOnlyForConfig`, activo solo en `melon-web`): del compose se leen los archivos que se montan
  sueltos, los archivos del compose y el de variables; solo su cambio reinicia. Verificado en `melon-web`: un cambio de código PHP no reinicia
  (0 s), uno en `nginx.conf` sí (20 s). Los demás proyectos siguen con la huella de todo el worktree.
- **Lucy sin contenedores** (`dependenciesOnlyForReading`, activo solo en `melon-web`): los tickets y el chat reciben `vendor/` copiado de la
  caché y un aviso de que no hay entorno (sin `bin/console` ni la app). Medido: **8.4 s** en vez de ~65 s. Si la caché está vacía se levanta
  el entorno completo y la arma. Si el chat llega con el entorno de la ejecución ya arriba, lo reutiliza.
  - **Se pierde:** Lucy ya no puede correr comandos con la app arriba (por ejemplo `bin/console debug:router`, que usó en una ejecución).
    Si hace falta, se desactiva por proyecto quitando la opción.
- **Carpetas fuera de la imagen:** al levantar el entorno completo, `vendor/` y `.codegraph/` se mueven fuera del worktree mientras se
  construye la imagen y se devuelven después (el Dockerfile hace `COPY . /app`). Sin eso, un entorno completo que viene después de un trabajo
  liviano reconstruía la imagen (`compose up` 35.6 s); ahora 7.8 s. La primera versión las renombraba dentro del worktree y seguían entrando
  al contexto: hay que moverlas afuera.
- **Copia de `vendor/` desde la caché:** 8 a 19 s según el disco (24.044 archivos).

## Llevado a todos los proyectos (2026-10-28)

Los proyectos con entorno son `melon-web`, `melontienda-web` (nuevo), `miobra-web`, `miplanta-web`, `miseguridad-web` y `melon-volumenes-web`
(`miflota-web` sigue pendiente a propósito). En todos están activos la caché de `vendor/` (`dependencyCache`) y el reinicio solo por
configuración (`restartOnlyForConfig`). Lucy conserva el entorno completo (`dependenciesOnlyForReading` quedó apagado: le gusta poder correr
comandos).

- **`opcache` revisado en las imágenes:** `dsy-fpm-71-mariadb-ep:2` (MiObra, MiPlanta), `dsy-fpm-73-mariadb:6` (MiSeguridad), `app-php-7.3-alpine:4`
  (MiMixer) y `app-php-8.1-alpine:1` (Volúmenes) no lo traen; `tienda-melon:6` (Melón Tienda) lo trae con `validate_timestamps=1`, que revisa los
  archivos cada 2 s. Es seguro no reiniciar al cambiar código PHP.
- **Ojo con los workers:** un proceso de larga vida (los `messenger:consume` de `supervisor` en MiSeguridad) sigue con el código con que arrancó
  hasta que se reinicie. Ni los tests ni las rutas HTTP lo notan (php-fpm recarga por pedido), pero un cambio en un handler asíncrono no se ve
  hasta un reinicio. En Melón Tienda el worker usa `--limit=1` y se reinicia solo.
- **Cachés sembradas** con un calentamiento por proyecto (`GET /` → 200 en todos): `melon-web` 328 MB, `melontienda-web` 276 MB, `miobra-web` 149 MB,
  `miplanta-web` 260 MB, `miseguridad-web` 365 MB, `melon-volumenes-web` 275 MB (en `<workDir>/deps/`). Entorno completo medido en el calentamiento:
  `melon-volumenes-web` 37 s, `miobra-web` 52 s, `melontienda-web` 60 s, `miplanta-web` 65 s, `miseguridad-web` 73 s, `melon-web` ~62 s.
- **CodeGraph** en los 11 clones (incluidos los de las apps): `codegraph.repos` lista todos. Índices de 1,7 MB (`melon-volumenes-web`) a 232 MB
  (`melon-web`); el más lento de crear fue `melon-volumenes-pwa` (62 s) y `miplanta-web` (40 s).

## Pendiente: dependencias compartidas (punto 4)

**Problema.** El runner no instala dependencias: lo hace el agente cuando se le ocurre, y cada worktree las instala de cero (de cinco
worktrees medidos, tres tenían `node_modules` de 580 a 760 MB). Cada ejecución nueva paga esa instalación.

**Idea.** Una caché de dependencias por repo y por lockfile:

- Ruta: `<workDir>/deps/<repo>/<hash del package-lock.json>/node_modules`.
- Al terminar un trabajo, si el worktree tiene `node_modules` y no hay caché para ese hash, se copia (`cp -a`, con `--reflink=auto` si el
  disco lo permite) a la caché.
- Al armar un worktree nuevo (`setUp` en `workspace.ts`), si hay caché para el hash de su lockfile, se copia antes de que el agente
  empiece; el agente solo instala si el lockfile cambió.
- Lo mismo se puede hacer con `vendor/` de PHP (hash de `composer.lock`) para los repos de Symfony.

**Estado (2026-10-27): construido y activado para `melon-web`** (ver arriba). Lo que sigue describe el diseño y por qué se eligió así.

**Por qué una copia y no un volumen o un enlace.**

- Copiar 600 MB solo gana si `npm install` tarda bastante más que la copia (en ext4 de WSL no hay reflink: es una copia real). Hay que
  comprobarlo con los tiempos de la medición (fases `entorno` e `IA`) antes de construirlo.
- Enlaces duros (`cp -al`) serían instantáneos pero peligrosos: npm o el agente pueden modificar archivos en el lugar y contaminar la
  caché y los demás worktrees. Se descartan.
- Hay que decidir cuándo se invalida (cambio de lockfile, de versión de Node, de arquitectura) y cuánto espacio puede ocupar.

**Cuándo retomarlo.** Después de unas cuantas ejecuciones reales con la medición activa: si la fase de entorno o la instalación pasan de
~30 s por trabajo o por ejecución, vale la pena.

## Otras ideas, sin empezar

- **Mapa del repo en el prompt** (rutas más firmas de clases y funciones, con `ctags` o tree-sitter, regenerado en cada `fetch`): que el
  desarrollador, el revisor y Lucy sepan por dónde empezar sin explorar. No depende de que la IA decida usar una herramienta. Un grafo
  como `codebase-memory-mcp` quedaría como complemento: en la práctica la IA prefiere `Grep` y `Read` y no siempre lo usa.
- **Tickets de repositorios distintos en paralelo.** El runner hace un trabajo a la vez; los de `melon-web` y `melon-ionic` usan
  worktrees distintos. Es el mayor ahorro posible y el cambio más grande.
- **Esfuerzo o modelo por tipo de trabajo** (revisión y chat con menos `--effort`): barato de probar, pero baja la calidad si se pasa.
- **Chat con el entorno bajo demanda:** levantarlo solo cuando Lucy necesita ejecutar algo (por ejemplo `curl`), no en cada pregunta.
