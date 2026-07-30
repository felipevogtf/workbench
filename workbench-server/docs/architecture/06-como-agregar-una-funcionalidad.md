# 6. Tutorial: agregar una funcionalidad nueva

Vamos a agregar, paso a paso, un endpoint para crear un issue local a mano (no sincronizado desde
Plane): `POST /tasks/projects/:projectId/issues`. Sirve como plantilla para cualquier funcionalidad
nueva que agregues siguiendo el mismo patrón del proyecto.

La regla general del orden: **de adentro hacia afuera**. Primero preguntate qué necesita el
dominio, después armás el caso de uso, y al final conectás la entrada (HTTP) y la salida
(si hiciera falta infraestructura nueva).

## Paso 1 — ¿La entidad de dominio ya sabe hacer esto?

Miramos `src/tasks/domain/entities/issue.entity.ts`. Ya existe `Issue.createLocal(...)`:

```ts
static createLocal(
  data: Pick<IssueProps, 'name' | 'projectId' | 'description'>,
): Issue {
  return new Issue({
    ...data,
    id: crypto.randomUUID(),
    isLocal: true,
    externalId: null,
    // ...
  });
}
```

Ya cubre lo que necesitamos: crea un issue nuevo, marcado como local (`isLocal: true`, sin
`externalId`). Si la regla de negocio ya existiera, no hace falta tocar nada acá. Si necesitaras una
regla nueva (por ejemplo, "un issue local no puede crearse sin descripción"), este es el lugar: dentro
del método de la entidad, **no** en el controller ni en el service.

## Paso 2 — ¿El puerto ya tiene el método que necesito?

`IssueRepositoryPort` (`src/tasks/domain/ports/issue-repository.port.ts`) ya tiene `save(issue:
Issue): Promise<void>`. No necesitamos agregar nada acá tampoco — con `save` alcanza para persistir
el issue nuevo.

> Si necesitaras una consulta nueva (ej. "buscar issues por prioridad"), este sería el paso donde
> agregás el método a la interfaz del puerto, y **después** implementás ese método en cada
> adaptador que lo implemente (`TypeOrmIssueRepository` en este caso).

## Paso 3 — Agregar el caso de uso en `TasksService`

`src/tasks/domain/application/tasks.service.ts`:

```ts
async createLocalIssue(
  projectId: string,
  data: { name: string; description: string | null },
): Promise<Issue> {
  const issue = Issue.createLocal({
    name: data.name,
    projectId,
    description: data.description,
  });
  await this.issueRepository.save(issue);
  return issue;
}
```

Esta es la única función que decide "cómo se crea un issue local": arma la entidad con
`Issue.createLocal(...)` (dejando que la entidad valide sus propias reglas) y la persiste con el
puerto. El controller no va a saber nada de esto — solo va a llamar a este método.

## Paso 4 — DTOs de entrada y salida

Para el body del POST, agregamos un DTO en `src/tasks/dto/`:

```ts
// src/tasks/dto/create-issue.dto.ts
export class CreateIssueDto {
  name!: string;
  description?: string | null;
}
```

(La respuesta ya la tenés resuelta: `IssueResponseDto`, que ya existe y ya se usa en
`findByProject`.)

## Paso 5 — Conectar el controller

`src/tasks/tasks.controller.ts`:

```ts
@Post('projects/:projectId/issues')
async create(
  @Param('projectId') projectId: string,
  @Body() dto: CreateIssueDto,
): Promise<IssueResponseDto> {
  const issue = await this.tasksService.createLocalIssue(projectId, {
    name: dto.name,
    description: dto.description ?? null,
  });
  return this.toResponseDto(issue);
}
```

Nada más. El controller sigue sin saber qué es un `IssueRepositoryPort`, sin importar TypeORM, sin
saber si el issue se guarda en Postgres o en cualquier otro lado.

## Resumen del checklist para cualquier funcionalidad nueva

1. **¿Es una regla de negocio?** → va en la entidad de dominio (`domain/entities/`).
2. **¿Necesito un dato o una operación que un puerto no ofrece todavía?** → agregá el método a la
   interfaz del puerto (`domain/ports/`), y después implementalo en cada adaptador
   (`infrastructure/repositories/` o `infrastructure/adapters/`).
3. **¿Es "orquestar varios pasos para cumplir una acción"?** → va en el caso de uso
   (`domain/application/tasks.service.ts`, o un archivo nuevo si el caso de uso es grande).
4. **¿Es la forma del JSON de entrada/salida por HTTP?** → un DTO nuevo en `dto/`.
5. **¿Es "cómo llega la request HTTP y a qué caso de uso se delega"?** → el controller
   (`tasks.controller.ts`), llamando siempre a un método de `TasksService`, nunca a un puerto
   directamente.
6. Si agregaste un puerto/adaptador nuevo (no solo un método a uno existente), registralo en
   `tasks.module.ts` con `{ provide: MI_TOKEN, useClass: MiAdaptador }`.

Por último, en **[07-reglas-y-errores-comunes.md](./07-reglas-y-errores-comunes.md)** hay una lista
de errores reales que se cometieron mientras se armaba este proyecto — vale la pena leerla para no
repetirlos.
