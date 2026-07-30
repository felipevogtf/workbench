# 2. Mapa del proyecto

Toda la funcionalidad de tareas vive dentro de `src/tasks/`. Esta es la estructura completa, con
qué representa cada carpeta:

```
src/tasks/
├── domain/                          ← el "adentro" del hexágono
│   ├── entities/                    ← reglas de negocio puras (sin async, sin infraestructura)
│   │   ├── issue.entity.ts
│   │   ├── issue.props.ts
│   │   ├── project.entity.ts
│   │   ├── project.props.ts
│   │   ├── label.entity.ts
│   │   ├── label.props.ts
│   │   ├── state.entity.ts
│   │   └── state.props.ts
│   ├── ports/                       ← interfaces: "qué necesito del mundo exterior"
│   │   ├── issue-repository.port.ts
│   │   ├── project-repository.port.ts
│   │   ├── label-repository.port.ts
│   │   ├── state-repository.port.ts
│   │   └── task-source.port.ts
│   └── application/                 ← casos de uso: orquestan los puertos
│       └── tasks.service.ts
│
├── infrastructure/                  ← el "afuera" del hexágono: implementaciones concretas
│   ├── persistence/                 ← entidades de TypeORM (mapeo a tablas SQL)
│   │   ├── issue.orm-entity.ts
│   │   ├── project.orm-entity.ts
│   │   ├── label.orm-entity.ts
│   │   └── state.orm-entity.ts
│   ├── repositories/                ← adaptadores que implementan los *-repository.port.ts
│   │   ├── typeorm-issue.repository.ts
│   │   ├── typeorm-project.repository.ts
│   │   ├── typeorm-label.repository.ts
│   │   └── typeorm-state.repository.ts
│   ├── clients/                     ← "traductor crudo" del protocolo HTTP de Plane
│   │   ├── plane-api.client.ts
│   │   └── plane-api.types.ts
│   └── adapters/                    ← adaptador que implementa task-source.port.ts
│       └── plane-api.adapter.ts
│
├── dto/                              ← forma de los datos que salen por HTTP
│   └── issue-response.dto.ts
│
├── tasks.controller.ts               ← adaptador de entrada (HTTP)
└── tasks.module.ts                   ← "el enchufe": conecta puertos con adaptadores
```

## Por qué está separado así

### `domain/entities/` — las reglas de negocio, sin excusas

Abrí `src/tasks/domain/entities/issue.entity.ts`. Fijate que:

- La clase `Issue` tiene el **constructor privado**. La única forma de crear una instancia es a
  través de sus métodos estáticos: `Issue.createLocal(...)` (para crear un issue nuevo desde cero)
  o `Issue.reconstruct(...)` (para "revivir" un issue que ya existía, leído desde la base de
  datos). Esto evita que en cualquier parte del código alguien arme un `Issue` con datos inválidos
  a mano.
- Tiene métodos como `validateDates()` que se ejecutan automáticamente al crear o modificar el
  issue, y lanzan un error si `startDate > dueDate`. Esa es una regla de negocio real, y vive **acá
  adentro**, no en un controller ni en un repositorio.
- **No hay ni un solo `import` de TypeORM, NestJS o Axios en este archivo.** Eso no es casualidad:
  es la regla más importante de toda la carpeta `domain/`. Si alguna vez ves un `import` de
  `typeorm` o `@nestjs/axios` dentro de `domain/entities/`, algo está mal.

### `domain/ports/` — los contratos

Abrí `src/tasks/domain/ports/issue-repository.port.ts`:

```ts
export interface IssueRepositoryPort {
  findById(id: string): Promise<Issue | null>;
  findByExternalId(externalId: string): Promise<Issue | null>;
  findByProjectId(projectId: string): Promise<Issue[]>;
  save(issue: Issue): Promise<void>;
  delete(id: string): Promise<void>;
  nextLocalId(): Promise<number>;
}

export const ISSUE_REPOSITORY_PORT = Symbol('ISSUE_REPOSITORY_PORT');
```

Esto es un contrato: "quien quiera ser un repositorio de issues tiene que poder hacer estas 6
cosas". No dice **cómo** — no menciona SQL, TypeORM, ni ningún detalle. El `TASK_SOURCE_PORT` de
abajo es igual pero para "traer issues de una fuente externa" en vez de "persistirlos".

El `Symbol(...)` que ves al final de cada archivo de puertos se explica en detalle en
**[05-inyeccion-de-dependencias.md](./05-inyeccion-de-dependencias.md)** — por ahora alcanza con
saber que es un identificador único que usa NestJS para saber "cuando alguien pida
`IssueRepositoryPort`, dale esta implementación concreta".

### `domain/application/` — los casos de uso

`TasksService` (`src/tasks/domain/application/tasks.service.ts`) es distinto a las entidades: **sí**
hace `async/await`, **sí** llama a varios puertos en secuencia. Por ejemplo, `syncMyIssues()`:

1. Le pide al `TaskSourcePort` los issues remotos.
2. Para cada uno, usa `ProjectRepositoryPort` para asegurarse de que el proyecto ya exista
   localmente (si no, lo crea).
3. Usa `IssueRepositoryPort` para ver si el issue ya existe y decidir si actualizarlo o crearlo.

Eso es "orquestación": ninguno de esos 3 pasos es una regla de negocio en sí misma (esas viven en
las entidades), pero juntarlos en el orden correcto para cumplir "sincronizar mis issues" sí es
trabajo de la capa de aplicación.

### `infrastructure/` — todo lo que toca el mundo real

Todo lo que necesita hablar con Postgres, HTTP, o cualquier sistema externo vive acá, dividido en:

- **`persistence/`**: las clases con decoradores de TypeORM (`@Entity`, `@Column`, etc.) que
  definen cómo se ven las tablas SQL. Son **distintas** de las entidades de dominio a propósito —
  mirá que `IssueOrmEntity` (en `infrastructure/persistence/issue.orm-entity.ts`) tiene columnas
  como `external_id`, `is_local`, con decoradores de TypeORM, mientras que `Issue` (en
  `domain/entities/issue.entity.ts`) no sabe nada de columnas ni de SQL.
- **`repositories/`**: implementan los puertos de `domain/ports/*-repository.port.ts` usando
  TypeORM. Por ejemplo `TypeOrmIssueRepository implements IssueRepositoryPort`. Acá vive la
  traducción entre "entidad ORM de TypeORM" y "entidad de dominio" (los métodos privados
  `toDomain()` / `toOrm()` que vas a ver en cada repositorio).
- **`clients/`**: el cliente HTTP crudo que sabe hablar el protocolo específico de la API de Plane
  (`plane-api.client.ts`) y los tipos que describen las respuestas tal cual las devuelve Plane
  (`plane-api.types.ts`, con nombres como `PlaneIssue`, con propiedades `snake_case` porque así las
  devuelve la API de Plane).
- **`adapters/`**: implementan los puertos que no son de persistencia. `PlaneApiAdapter implements
  TaskSourcePort` — usa el `PlaneApiClient` para traer datos de Plane y los traduce al lenguaje del
  dominio (`RemoteIssueData`, sin ningún `snake_case` ni vocabulario de Plane).

### `tasks.controller.ts` — la puerta de entrada HTTP

Recibe requests HTTP y los traduce a llamadas al caso de uso (`TasksService`). No contiene lógica
de negocio, no habla directo con ningún repositorio — ese es justamente uno de los errores que se
corrigió en este proyecto (ver
**[07-reglas-y-errores-comunes.md](./07-reglas-y-errores-comunes.md)**).

### `tasks.module.ts` — el enchufe

Es el único archivo que conoce **ambos lados**: los puertos (interfaces) y los adaptadores
(implementaciones concretas). Le dice a NestJS "cuando alguien pida `ISSUE_REPOSITORY_PORT`, dale
una instancia de `TypeOrmIssueRepository`". Se explica en detalle en el próximo capítulo.

Seguimos con un ejemplo completo, de punta a punta, en
**[03-flujo-sync.md](./03-flujo-sync.md)**.
