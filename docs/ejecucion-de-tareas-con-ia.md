# Ejecutar tareas con IA

Plan para que, una vez que una tarea tiene su plan, agentes de IA la desarrollen de punta a punta: crean tickets, los desarrollan, los revisan y dejan una PR lista para revisar.

Estado: **fase 1 implementada** en la rama `feat/task-executions` (servidor, runner y front), probada de punta
a punta con el `claude` real sobre un repo local. Falta probar la apertura real de la PR en Bitbucket y decidir
si se incorpora a `main`.

### Cómo quedó la fase 1 respecto al plan

- **Varios tickets, en orden, en una sola rama.** En vez de un solo ticket, el agente crea hasta 5 y se
  desarrollan uno tras otro sobre la misma rama (sin paralelismo ni integración de ramas: eso es la fase 1b).
- **Los tickets viven dentro de la ejecución** (columna JSON), no en una tabla aparte.
- **El runner hace los commits**, no el agente: el desarrollador solo edita y corre pruebas, y el runner
  guarda lo que quedó. Por eso `task-developer` no tiene `git add` ni `git commit`.
- **Revisión:** hasta 2 revisiones por ticket; si la segunda sigue pidiendo cambios, la ejecución falla y
  «Reintentar» da una vuelta más de corrección.
- **Reintentar** repite el trabajo que falló sin rehacer lo anterior; si lo que falló fue abrir la PR, solo se
  repite eso (la rama ya está subida).
- **Revisor de la PR:** Bitbucket no deja que el autor (el dueño del token) se revise a sí mismo, así que la
  PR sale sin revisor salvo que se configure `EXECUTIONS_PR_REVIEWERS` con las cuentas (uuid) de otras personas.
- **Aislamiento del agente en el PC:** corre con `--setting-sources project`, `--strict-mcp-config`,
  `--no-session-persistence` y un tope de gasto por trabajo (`maxBudgetUsd`).


## 1. Objetivo

Desde la pantalla de una tarea con plan, pulsar **Ejecutar** y que:

1. Un agente lea el plan y cree **tickets internos**.
2. Otros agentes **desarrollen** cada ticket en su propia rama.
3. Otro agente **revise** cada ticket y pida correcciones si hace falta.
4. Se publique una **rama y una PR** con el usuario asignado como revisor.

Además, el flujo debe ser **editable** desde el front: por ejemplo, apagar la revisión, agregar más agentes de desarrollo, o que un agente delegue partes mecánicas a otros con modelos más baratos. Qué parte de eso entra en cada fase está en la sección 10.

## 2. Decisiones tomadas

| Tema | Decisión |
| --- | --- |
| Tickets | Siempre internos, en la base de workbench. No se escribe en Plane. |
| Dónde corre el trabajo | En el **PC del usuario**, no en `personal_server`. El PC suele estar encendido cuando se quiere ejecutar. |
| Cómo llega el trabajo al PC | Un **runner local** que llama al servidor (conexión saliente). No es una PWA: el navegador no puede ejecutar procesos, `git` ni `claude`. |
| Red | Por **Tailscale**. El runner usa la misma dirección con la que el usuario abre la app: `http://personal-task-manager:4321/api` (alias en el archivo `hosts` de Windows). |
| Repos | El runner los **clona él mismo** en `E:\workbench-agent-repos`, sin tocar los proyectos del usuario. |
| Proveedor para probar primero | **Bitbucket.** GitHub llega en la fase 1b. |
| Publicar la rama | El runner hace `git push` por **SSH** con las llaves del PC. El runner no lleva ningún token de API. |
| Crear la PR y asignar revisor | El **servidor**, por API, con los clientes de GitHub y Bitbucket que ya existen en `pr-review`. No se usa el CLI `gh`. |
| Sesión de Claude | La del PC donde corre el runner. |

## 3. Pendiente de decidir

Con Bitbucket como primer proveedor, hay que **confirmar que el token del servidor (`BITBUCKET_TOKEN`) puede crear PRs y asignar revisores**. Hoy el cliente solo lee y comenta. Para asignar un revisor, Bitbucket pide su identificador de cuenta, que hay que guardar en la configuración.

Propuestas por defecto, a confirmar o cambiar:

- **Pausas de aprobación:** una tras crear los tickets y otra antes de abrir la PR (la segunda es opcional, porque la PR ya te asigna como revisor).
- **Interruptores del flujo:** en la fase 1 el flujo queda fijo. Los interruptores (por ejemplo apagar la revisión) llegan en la 1b.
- **Límites:** 2 tickets en paralelo y 2 vueltas máximas entre revisión y desarrollo.

## 4. Idea central: el flujo como datos

Un **flujo** es una lista de etapas guardada en la base. Una **ejecución** es ese flujo corriendo sobre una tarea, con el estado de cada etapa guardado. Esto permite ver qué hizo cada agente, pausar, reintentar una etapa o cambiar el flujo sin tocar código.

Cada etapa define:

- **Activa:** si se ejecuta o se salta. Sin revisión, un ticket pasa de «en curso» a «hecho» cuando el desarrollador termina.
- **Agente:** con su modelo y herramientas.
- **Entrada:** el plan, o la salida de una etapa anterior.
- **Modo:** una vez, o **por cada ticket** (en paralelo con un límite).
- **Aprobación:** si espera el visto bueno del usuario antes de seguir.
- **Reintentos:** cuántos, y a qué etapa vuelve si falla.
- **Delegación (fase 2):** a qué agentes puede delegar, y con qué modelo.

### Flujo base

| # | Etapa | Modo | Agente | Resultado |
| --- | --- | --- | --- | --- |
| 1 | Tickets | una vez | `task-tickets` | Lista de tickets en JSON estructurado |
| – | Aprobación | pausa | persona | Edita, borra o aprueba tickets |
| 2 | Desarrollo | por ticket | `task-developer` | Commits en la rama del ticket |
| 3 | Revisión | por ticket | `task-reviewer` | Aprobado, o rechazado con feedback (vuelve a 2) |
| 4 | Integración | una vez | motor + runner | Rama unida, push y PR con revisor asignado |

## 5. Arquitectura

```
 Navegador ──► Servidor (personal_server) ◄── Runner (PC del usuario)
               · flujos, ejecuciones            · clona repos, worktrees
               · tickets, estado                · corre `claude -p`
               · aprobaciones, interfaz         · commit y git push por SSH
               · crea la PR por API
```

- El **servidor** es el cerebro y siempre está disponible: guarda el estado y decide qué etapa sigue.
- El **runner** es un ejecutor sin estado propio: pide trabajo, lo hace y devuelve el resultado.
- Si el runner no está conectado, la ejecución queda en **«esperando runner»** y continúa sola cuando vuelve.

### Conexión por Tailscale

- El servidor y el PC están en la misma red de Tailscale. El puerto de la app (`4321`) está atado en el servidor solo a su IP de Tailscale (`WORKBENCH_BIND`), así que **no escucha en la IP pública**: la app no es alcanzable desde internet.
- El runner llama al servidor en `http://personal-task-manager:4321/api`. El nginx de la app ya reenvía `/api/` al servidor; las rutas del runner cuelgan de ahí, sin abrir otro puerto.
- **Siempre es el runner quien llama.** El servidor no se conecta al PC, así que no hay que abrir puertos en Windows ni tocar su firewall.
- Pide trabajo con **long polling**: la petición queda abierta unos 30 segundos hasta que haya trabajo y entonces responde. Llega casi al instante sin una conexión permanente, y cabe en el `proxy_read_timeout` de 600 s del nginx.
- Seguridad de red: la red de Tailscale ya limita quién llega. No hace falta restringir rutas en nginx; la única capa extra es el **token del runner**.

### Protocolo servidor ↔ runner

| Acción | Para qué |
| --- | --- |
| Registrarse | El runner se identifica con su token y declara su configuración |
| Latido | Avisa que sigue vivo; si deja de llegar, sus trabajos vuelven a la cola |
| Pedir trabajo | Recibe un trabajo (agente, prompt, repo, ticket) |
| Enviar registros | Va mandando la salida del agente mientras trabaja |
| Entregar resultado | Éxito o fallo, con la salida estructurada |

El token del runner se genera desde la app y se puede revocar.

### Trabajo de un ticket en el runner

1. Clona el repo si no lo tiene (por SSH) y hace `fetch`.
2. Crea una rama y un `git worktree` propios del ticket.
3. Corre `claude -p` con el prompt del agente, solo dentro de ese worktree.
4. Hace commit; en la integración une las ramas y hace `git push`.
5. El servidor, al recibir el resultado, crea la PR y asigna al usuario como revisor.

## 6. Seguridad

Hasta ahora todos los agentes eran de solo lectura. Con escritura:

- **Aislamiento:** un worktree por ticket, para que dos agentes en paralelo no se pisen.
- **Herramientas:** `Edit` y `Write` solo dentro del worktree. `Bash` limitado a una lista (tests, lint, build). Sin `git push`, sin red arbitraria.
- **La lista manda el runner:** las herramientas permitidas se fijan en la configuración local del runner. El servidor solo puede pedir un subconjunto. Así, aunque comprometieran el servidor, nadie podría hacer que el PC ejecute comandos arbitrarios.
- **Publicar lo hace el sistema,** no el agente: el agente deja commits y nada más.
- **Llaves SSH:** no salen del PC. Conviene que la llave que use el runner tenga acceso solo a los repos necesarios.
- **Límites:** tiempo máximo por etapa, concurrencia máxima, botón de cancelar y costo visible por etapa.
- **Token del servidor:** el que se use para crear PRs debería tener solo permiso de contenido y PRs en los repos necesarios.

## 7. Modelo de datos (servidor)

Módulo nuevo `executions`, con la misma arquitectura hexagonal de los demás.

| Entidad | Contenido principal |
| --- | --- |
| `Workflow` | Nombre, versión, lista de etapas (JSON) |
| `Execution` | Tarea, flujo y versión usada, ajustes de esa ejecución, estado, PR creada |
| `StageRun` | Ejecución, etapa, estado, vueltas, inicio y fin, costo |
| `Ticket` | Ejecución, título, descripción, criterios, dependencias, estado (pendiente, en curso, en revisión, hecho, fallido), rama |
| `Job` | Etapa o ticket, agente, prompt, estado, runner que lo tomó, resultado, registros |
| `Runner` | Nombre, token (hash), último latido, configuración declarada |

Estados de una ejecución: `en cola`, `esperando runner`, `en curso`, `esperando aprobación`, `completada`, `fallida`, `cancelada`.

## 8. Agentes nuevos

Cada uno con su módulo, para poder cambiarlos desde la pantalla de agentes como los demás.

| Agente | Módulo | Herramientas | Salida |
| --- | --- | --- | --- |
| `task-tickets` | `task-tickets` | Solo lectura | JSON con la lista de tickets |
| `task-developer` | `task-developer` | Lectura, `Edit`, `Write` y `Bash` limitado | Commits en el worktree |
| `task-reviewer` | `task-reviewer` | Solo lectura y `git diff` | JSON: aprobado o rechazado con motivos |

Las listas de herramientas deben reflejarse también en el front (`agent.ts`) para que `contract-drift.spec.ts` siga pasando.

## 9. Interfaz

### Qué hace el front en la fase 1

Lanzar y ver la ejecución; todavía no cambiar el flujo.

**En la tarea**
- Botón **Ejecutar**, solo si la tarea ya tiene plan.
- Aviso si no hay runner conectado: la ejecución quedará esperando, no fallará.

**En la vista de la ejecución**
- Etapas con su estado (pendiente, en curso, hecha, fallida).
- El ticket, con título, descripción, criterios y estado.
- Registros en vivo de cada agente.
- Al terminar, enlace a la rama y a la PR.
- Cancelar una ejecución en curso y reintentar una etapa fallida.
- Historial de ejecuciones de la tarea.

**Pantalla del runner**
- Si está conectado y su último latido.
- Generar y revocar su token.

### Qué no hace en la fase 1

- Cambiar el flujo (apagar la revisión, cambiar de agente, ajustar el paralelismo), salvo que se decida adelantar los interruptores (sección 3).
- Aprobar o editar tickets antes de que se desarrollen: en la fase 1 no hay pausas.
- Varios tickets en paralelo: la fase 1 trabaja con un solo ticket.

### Qué se agrega después

- **Fase 1b:** pausa de aprobación con edición de tickets, y una tarjeta por etapa con interruptores: activar o desactivar, pausa de aprobación, agente, paralelismo y vueltas máximas. Se configura en dos niveles: el **flujo por defecto** y un **ajuste por ejecución**, visible antes de pulsar Ejecutar, para saltarse la revisión solo en una tarea chica. Con la revisión apagada nadie comprueba que el ticket cumpla lo pedido antes de la PR, así que el interruptor debería mostrar un aviso.
- **Fase 2:** agregar y reordenar etapas, varios desarrolladores y delegación a modelos baratos.

## 10. Fases

### Fase 1 — de punta a punta con un ticket

1. Modelo de datos y migraciones.
2. API del runner (registro, latido, pedir trabajo con long polling, registros, resultado).
3. **Runner** mínimo: clona, crea worktree, corre `claude -p`, hace commit y push.
4. Motor con el flujo base y **un solo ticket**.
5. Crear PR por API y asignar revisor, primero en un proveedor.
6. Vista de la ejecución y pantalla del runner en el front.

Criterio de éxito: desde una tarea con plan se obtiene una PR con un ticket desarrollado, revisada por el agente y con el usuario como revisor.

### Fase 1b — varios tickets, aprobaciones y flujo configurable

1. Etapas «por ticket» en paralelo con límite.
2. Pausas de aprobación y edición de tickets.
3. Bucle de revisión con vueltas máximas.
4. Interruptores por etapa y ajuste por ejecución.
5. Cancelar, límites de tiempo y costo por etapa.
6. Segundo proveedor.

### Fase 2 — flujo editable por completo

1. Editor de etapas: agregar, quitar, reordenar y cambiar agentes.
2. Varios agentes de desarrollo en paralelo sobre un mismo ticket o repartiéndose tickets.
3. **Delegación a modelos baratos:** cada etapa puede delegar por dentro con subagentes nativos de Claude Code (`--agents`), cada uno con su modelo. Ejemplo: un desarrollador en Sonnet delega tests y renombres a un subagente en Haiku. En el editor es un campo «puede delegar a…».
4. Versiones del flujo y plantillas por tipo de tarea.

## 11. Riesgos

- **Costo:** cada ticket es una llamada larga. La pausa tras los tickets y los límites por etapa lo acotan.
- **Calidad del reparto en tickets:** si los tickets quedan acoplados, los desarrolladores en paralelo generarán conflictos al integrar. El prompt de `task-tickets` debe pedir tickets independientes y declarar dependencias.
- **Conflictos al integrar:** hay que decidir qué hacer si dos ramas chocan (propuesta: marcar el ticket como fallido y avisar, sin resolver automáticamente).
- **PC apagado o sin red a mitad de una ejecución:** los trabajos vuelven a la cola por falta de latido y se reintentan desde la última etapa guardada.
- **Permisos del token de PRs:** hoy los clientes solo leen y comentan; hay que confirmar o ampliar el alcance del token.
- **Diferencias de Windows:** rutas largas, finales de línea y `git worktree` en el PC. Se prueban desde la primera iteración del runner.

## 12. Fuera de alcance por ahora

- Escribir o sincronizar tickets con Plane.
- Que el agente haga `push` o cree la PR por su cuenta.
- Ejecutar agentes en `personal_server`.
- Resolución automática de conflictos entre ramas.
- App de escritorio para el runner (primero una línea de comandos).
