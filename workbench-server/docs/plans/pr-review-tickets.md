# Plan: tickets de Plane en la revisión de PRs

Estado: **propuesta, sin implementar**. Continúa [pr-review.md](./pr-review.md): el agente que revisa cada PR
también evaluará **si la PR cumple lo que pide el ticket de Plane** que la descripción referencia.

## 1. Objetivo y alcance

- El nombre de la rama y la descripción de la PR pueden mencionar uno o varios tickets de Plane. El sistema
  los detecta, los consulta en Plane y se los entrega al agente junto con el diff.
- La revisión incluye una sección nueva, **`## Cumplimiento del ticket`**: qué pide el ticket, qué cubre la
  PR, qué falta y qué es dudoso.
- Una PR puede cubrir **más de un ticket**.
- Una PR **sin ticket** se revisa igual; la revisión lo señala como sugerencia.
- Si Plane no responde o la clave no existe, la revisión sigue y lo anota. Nunca falla por esto.

Reglas acordadas:

- **Los tickets se buscan en dos lugares: el nombre de la rama y la descripción de la PR.** Los resultados
  de ambos se **juntan y se quitan repetidos**: un ticket en la rama y otro en la descripción cuentan los
  dos. El título de la PR queda fuera.
- **Solo se detectan códigos** (`MEL-253`). No hay lógica para enlaces ni para otros formatos.
- Los tickets pueden ser de **cualquier proyecto** de Plane, no solo `MEL`.
- Sin ticket asociado = sugerencia en la revisión, no un error.

Fuera de alcance (v1): comentarios del ticket, el título de la PR como fuente, adjuntos e imágenes del ticket,
cambiar el estado del ticket en Plane.

## 2. Qué se verificó contra tu Plane

Consultas de solo lectura desde el contenedor de producción:

| Dato | Resultado |
|---|---|
| Instancia | `https://plane.garagelabs.cl`, workspace `garage-labs` |
| Credenciales | Las mismas variables que usaba `personal-task-manager` (`PLANE_API_URL`, `PLANE_API_KEY`, `PLANE_WORKSPACE_SLUG`, `PLANE_USER_ID`); ya copiadas a `server.env` de producción |
| Proyectos | 15, cada uno con su identificador: `MEL`, `SER`, `MSD`, `SERCSD`, `GLMVP`, `MTMX`, `CNSD`, `CBNT`, `PROEBV`, `MIELESHOPB`, `ARAYAYCIA`, `MASISAB2B`, `EPHSD`, `APS`, `PLANEIMPLE` |
| Ticket por clave | `GET /api/v1/workspaces/garage-labs/work-items/MEL-253/` devuelve 200 con `name`, `description_html`, `state`, `labels`, `priority`, `sequence_id`. No hace falta listar el proyecto |

El ticket `MEL-253` ("HU: [MiFlota Web] Entidad Maestro de Contrati…") coincide con la PR de miflota-web que
trae `MEL-253` en su rama, lo que confirma que las claves de las ramas y las de Plane son las mismas.

## 3. Cómo se detectan los tickets

Función pura del dominio:

```ts
extractTicketKeys(text: string, projectIdentifiers: readonly string[], max = 5): string[]
```

- Busca `IDENTIFICADOR-NÚMERO` con **guion**, sin distinguir mayúsculas: `MEL-253`, `mel-253`.
- Solo acepta identificadores que **existen en Plane** (la lista de proyectos), así `UTF-8` o `ES-2022` no se
  confunden con tickets.
- Devuelve las claves **normalizadas** (`MEL-253`), **sin repetidos**, en orden de aparición, con un máximo
  de 5 por PR.
- **Solo códigos**, sin interpretar enlaces. (Un enlace de Plane contiene la clave y quedaría detectada, pero
  el sistema no depende de eso.)
- Varios tickets: `MEL-183, MEL-182`, una clave por línea o `MEL-183-MEL-182` devuelven todas.
- Solo el guion: `APS 12` en una frase no cuenta como ticket. Las ramas del equipo ya usan guion, así que no
  hace falta más.

### Dónde se busca

La función se aplica al **nombre de la rama** (`sourceBranch`) y a la **descripción**, y se unen los
resultados: primero los de la rama, luego los de la descripción, sin repetidos y con el máximo de 5 en total.
Se recalcula cada vez que el sync trae la PR, así que si alguien edita la descripción o cambia la rama, las
etiquetas se actualizan solas.

Ejemplos con ramas reales de tus PRs:

| Rama | Claves detectadas |
|---|---|
| `feature/MEL-253/entida-conductores-camiones` | `MEL-253` |
| `feature/mel-349/sincronizacion-sucursales` | `MEL-349` |
| `feature/MEL-183-MEL-182/integracion-jd` | `MEL-183`, `MEL-182` |
| `festure/MEL-183/nueva-razon-bloqueo` (con el error de tipeo) | `MEL-183` |
| `fix/log-email`, `feature/firma-por-foto` | ninguna (podría venir en la descripción) |

### De dónde salen los identificadores (`MEL`, `SER`, …)

No se escriben a mano ni se sincronizan a la base de datos: se **piden a Plane en vivo**
(`GET /api/v1/workspaces/garage-labs/projects/`, campo `identifier`) y se **cachean 1 hora**. Si Plane falla,
se reutiliza la última lista conocida.

Con esa lista se arma la regex en el momento (los identificadores se escapan y se ordenan del más largo al
más corto para que `MIELESHOPB` no se corte):

```
\b(?:MIELESHOPB|ARAYAYCIA|MASISAB2B|PLANEIMPLE|PROEBV|SERCSD|…|MEL|SER|APS)-(\d{1,6})\b      (sin distinguir mayúsculas)
```

Por qué así y no de otra forma:

- **Proyectos nuevos se reconocen solos.** Si mañana creas el proyecto `XYZ` en Plane, en menos de una hora
  `XYZ-12` ya cuenta como ticket, sin tocar código.
- **No se filtra por "proyectos que tengo asignados".** Lo que importa es qué proyectos puede **leer** la API
  key, y eso es justo lo que devuelve esa consulta (hoy 15). Muchas PRs son de tickets que no están
  asignados a ti.
- **No sirve la tabla local de proyectos.** Esa tabla solo guarda los proyectos de los tickets que tienes
  asignados y no guarda el identificador.
- **Claves de proyectos que la key no ve** no se detectan como ticket. Para que no pasen desapercibidas, si la
  descripción trae algo con forma de clave (`ABC-123`) que no corresponde a ningún proyecto conocido, se deja
  un aviso en el log del servidor.

## 4. Arquitectura

Sigue el patrón del proyecto: `pr-review` define su propio puerto y un único adaptador conoce al módulo vecino
(igual que `AgentsGatewayPort` hacia `ai-agents`).

```
pr-review ──(TicketsGatewayPort)──► TasksGatewayAdapter ──► TicketLookupService (módulo tasks)
                                                                    │
                                                          PlaneApiClient (work-items/<KEY>/)
```

### Módulo `tasks` (lectura en vivo, no guarda nada)

- `PlaneApiClient`: método nuevo `getWorkItemByKey(key)` (`work-items/{KEY}/`) y el campo `identifier` en
  `PlaneProject`.
- `TicketLookupService` (aplicación, exportado): `findByKey(key)` y `listProjectIdentifiers()` (con caché de
  1 hora). Se apoya en los puertos de fuente de Plane que ya existen; ningún otro módulo importa
  `PlaneApiClient`.
- Los tickets de otras personas **no** se sincronizan a la BD de tasks (esa sincronización solo trae los
  tuyos); aquí se consultan directo.

### Módulo `pr-review`

- **Dominio**
  - `extractTicketKeys` (arriba) y el tipo `Ticket { key, title, stateName, labels, priority, descriptionText, url }`.
  - Puerto `TicketsGatewayPort`: `getTicket(key): Promise<Ticket | null>` y `getProjectIdentifiers()`.
  - `PullRequest` gana `description` y `ticketKeys`.
- **Infraestructura**
  - `TasksGatewayAdapter`: único archivo que importa de `tasks`. Convierte el HTML de Plane a texto.
  - `BitbucketAdapter` y `GithubAdapter` entregan la descripción (`description` y `body`).
- **Aplicación**
  - `PullRequestsService.sync()` calcula `ticketKeys` a partir de la rama y la descripción cada vez que trae la PR.
  - `ReviewsService.buildPrompt()` arma las secciones de descripción y tickets (sección 6).

## 5. Datos (una migración, generada con `npm run migration:generate`)

| Tabla | Columna | Detalle |
|---|---|---|
| `pull_requests` | `description` | `text`, nulo. Se llena en el siguiente sync de cada PR |
| `pull_requests` | `ticket_keys` | `text[]`, por defecto vacío. Para mostrar etiquetas sin esperar una revisión |
| `reviews` | `tickets` | `jsonb`, por defecto `[]`. **Foto** de lo que el agente evaluó: `[{ key, title, state, found }]`, para que el historial no cambie si luego editan el ticket en Plane |

Las PRs ya registradas reciben su descripción en el próximo sync; no hay que migrar datos a mano.

## 6. Qué recibe el agente

`buildPrompt` agrega, después de los datos de la PR:

```
## Descripción de la PR
<descripción, hasta ~4000 caracteres>

## Tickets asociados (Plane)
### MEL-253 — HU: Entidad Maestro de Contratistas
Estado: In Progress · Etiquetas: backend, miflota · Prioridad: high
<descripción del ticket en texto, hasta ~4000 caracteres>

### MEL-999
No se pudo leer el ticket (no existe o Plane no respondió).
```

Sin ticket: `Sin ticket asociado: la descripción de la PR no referencia ninguno.`

- La conversión de HTML a texto conserva listas y casillas (`- [ ]`) y descarta etiquetas, imágenes y
  estilos. Tope de 4000 caracteres por ticket y 16000 en total.
- Las consultas a Plane tienen **timeout de 10 s** y se hacen **en paralelo**; un ticket que falla no frena
  a los demás.

## 7. Prompt del agente (listo para pegar)

Se edita en **Agentes de IA → `default-reviewer` → Prompt del agente**, en cada entorno. Incluye la
convención de Symfony que ya definiste y la sección nueva:

```
Eres un revisor de codigo senior. Revisa la Pull Request descrita al final.

Estas dentro de un clone del repo con la rama de la PR ya en checkout. Usa `git diff` para ver
los cambios y lee los archivos circundantes cuando necesites contexto. Solo lectura: no modifiques nada.

## Convenciones del equipo (no las reportes como problema)
- Proyectos Symfony: el esquema de la base de datos se actualiza siempre con
  `php bin/console doctrine:schema:update --force` (`d:s:u --force`), por ahora. Esto aplica
  aunque el repo tenga carpeta de migraciones. Por eso, cuando la PR cambie entidades o mapeos de
  Doctrine, no senales como problema que falte una migracion ni sugieras agregarla.
- Si la PR agrega o modifica archivos de migracion, revisalos como cualquier otro codigo, pero no
  exijas que existan.

## Tickets
Al final recibiras la descripcion de la PR y, si los hay, los tickets de Plane que referencia. Una PR
puede cubrir varios. El ticket describe lo que se pidio: compara contra el.

Responde SIEMPRE en español, en Markdown, con exactamente esta estructura y maximo ~500 palabras:

## Resumen
2-3 lineas de que hace la PR.

## Cumplimiento del ticket
Por cada ticket (`CLAVE`): lista lo que pide, y marca cada punto como Cubierto, Falta o Dudoso, con
`archivo:linea` cuando puedas. No des por cubierto lo que no veas en el diff. Si no hay ticket, escribe
"Sin ticket asociado" y, en Sugerencias, pide referenciarlo en la descripcion de la PR. Si un ticket no
se pudo leer, dilo y no inventes su contenido.

## Problemas
Lista de bugs probables, riesgos de seguridad o regresiones, cada uno con `archivo:linea` y por que
es un problema. Si no hay, escribe "Ninguno detectado". No inventes problemas.

## Sugerencias
Mejoras opcionales (legibilidad, tests faltantes, nombres). Maximo 5.

## Veredicto
Una de: `Aprobar`, `Aprobar con comentarios`, `Pedir cambios`, y una frase de justificacion. Si falta
algo importante del ticket, no apruebes sin comentarios.

Se concreto y evita elogios vacios.
```

## 8. Front

- **Modelos:** `PullRequest.ticketKeys: string[]` y `Review.tickets: { key, title, state, found }[]`.
- **Lista de PRs:** etiquetas con las claves (`MEL-253`), enlazadas a Plane, o una etiqueta tenue
  **"Sin ticket"**. En móvil, las etiquetas pasan a una línea propia.
- **Detalle de la PR:** sección **Tickets** con título y estado de cada uno. Para cada revisión del historial
  se muestra la foto de los tickets que se evaluaron.
- **Enlace a Plane:** el backend entrega la URL ya armada con `PLANE_API_URL` y el workspace
  (`https://plane.garagelabs.cl/garage-labs/browse/MEL-253/`); se confirma que ese formato abre el ticket en
  tu instancia.

## 9. Fases

1. **Descripción y detección.** Guardar `description`, calcular `ticketKeys` desde la rama y la descripción;
   tests de `extractTicketKeys` con las ramas reales de la tabla de la sección 3 (varios tickets, mayúsculas,
   error de tipeo, sin código, falsos positivos, repetidos entre rama y descripción).
2. **Consulta en Plane.** `getWorkItemByKey`, identificadores con caché y `TicketLookupService` en `tasks`;
   tests con la API simulada, incluyendo 404 y timeout.
3. **Contexto del agente.** Puerto y adaptador en `pr-review`, `buildPrompt`, foto en `reviews.tickets` y
   migración; tests de que un fallo de Plane no rompe la revisión.
4. **Prompt.** Actualizar `default-reviewer` en desarrollo y probar con una PR real que tenga ticket.
5. **Front.** Modelos, etiquetas y sección de tickets; revisión de diseño en móvil y escritorio.
6. **Producción.** Desplegar **con la cola vacía** (reiniciar interrumpe revisiones en curso), actualizar el
   prompt del agente en producción y verificar con la primera PR nueva.

## 10. Riesgos y decisiones

1. **Contenido no confiable.** La descripción de la PR y la del ticket las escribe una persona. Se tratan
   como el resto del contexto: el agente es de solo lectura y los textos tienen tope de largo.
2. **Permisos del API key.** Debe poder ver el proyecto del ticket; si no, Plane responde 404 y la revisión
   dice "no se pudo leer el ticket".
3. **Latencia y límites de Plane.** Timeout de 10 s, consultas en paralelo y sin reintentos en cadena; cada
   clave se consulta una vez por revisión.
4. **Falsos positivos.** Solo se aceptan identificadores reales y con guion.
5. **Cuota de Claude.** El contexto crece (descripción + tickets), lo que consume algo más por revisión.
6. **Algunas PRs no traen el código en ningún lado.** De las 23 PRs que hoy conozco, 18 lo traen en la rama;
   con rama y descripción, solo las ~5 sin código (como `fix/log-email`) saldrían con "Sin ticket asociado".
   Para esas conviene acordar una línea fija en la plantilla de PR: `Tickets: MEL-123, MEL-124`.

## 11. Para después

- Sumar el **título** como fuente (admitiendo el espacio, como en `mel 349`): se mantiene la regla de unir todas
  las fuentes y quitar repetidos.
- Incluir los **comentarios del ticket**, donde a veces están los criterios finales.
- Pasar los criterios de aceptación como lista y que el agente los marque uno a uno.

## 12. Criterios de aceptación

- Una PR de la rama `feature/MEL-253/…` con `SER-10` en la descripción muestra las dos etiquetas y la revisión
  trae una sección **Cumplimiento del ticket** que trata ambos tickets.
- Un mismo código en la rama y en la descripción cuenta una sola vez.
- Una PR sin ticket se revisa y la revisión lo señala; en el front aparece "Sin ticket".
- Si Plane no responde o una clave no existe, la revisión se completa y lo anota.
- El historial de una PR muestra qué tickets (título y estado) se evaluaron en cada revisión.
- `tsc`, lint y tests pasan en servidor y front.

## 13. Estado de la implementación

Implementadas las fases 1 a 5 (falta la 6, el despliegue a producción, y pegar el prompt del agente).

Verificado:

- **Datos reales (desarrollo):** sobre tus 23 PRs, **18 traen ticket** (5 no, como `fix/log-email`). Detecta
  varios a la vez: la #191 de miflota-web trae `MEL-253` en la rama y `MEL-251` en la descripción (dentro de
  un enlace de Plane).
- **Plane real:** el agente recibe cada ticket con título, estado, etiquetas y descripción, incluidas las
  casillas de criterios de aceptación (`- [ ]`).
- **Fallos:** si Plane no responde, un ticket no existe o tarda más de 10 s, la revisión se completa igual y
  lo anota. Cubierto con tests.
- **Tests:** 87 en el servidor y 44 en el front; `tsc` y lint sin errores.

Cambios respecto al plan:

- Se **omitió** el aviso de log para claves de proyectos desconocidos: habría avisado con `UTF-8`, `ISO-8601`,
  etc. en cada sync.
- No hay tope de 16000 caracteres en total: son como máximo 5 tickets de 4000 caracteres cada uno.
- La detección también lee la clave **dentro de los enlaces** de Plane de la descripción (las "tarjetas" de
  Plane traen la clave en la URL), sin lógica especial de enlaces.
- **Corrección de un error aparte:** Bitbucket entrega el commit abreviado (12 caracteres) y `git` completo
  (40); se comparaban como texto exacto y toda PR de Bitbucket aparecía "Desactualizada" apenas se
  sincronizaba tras revisarla. Ahora se compara por prefijo.

Pendiente: desplegar (con la cola vacía) y pegar el prompt de la sección 7 en el agente de cada entorno.
