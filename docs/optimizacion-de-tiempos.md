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

**Por qué no se hizo todavía.**

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
