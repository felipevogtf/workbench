# 7. Reglas de oro y errores comunes

Esta lista sale de errores **reales** que se cometieron mientras se armaba este proyecto, no de una
lista genérica de internet. Cada uno se corrigió — se documentan acá para que no se repitan.

## Regla 1 — El dominio no importa infraestructura, nunca

**La regla:** ningún archivo dentro de `domain/entities/` o `domain/ports/` puede tener un
`import` de `typeorm`, `@nestjs/typeorm`, `@nestjs/axios`, `axios`, ni ninguna librería que hable
con el mundo exterior.

**Cómo detectarlo:** si estás en un archivo de `domain/` y necesitás escribir `await` para algo que
no sea llamar a otro método de dominio, probablemente ese código no debería estar ahí.

## Regla 2 — El controller solo habla con casos de uso, nunca con puertos

**El error real que pasó acá:** en un momento, `TasksController` inyectaba `ISSUE_REPOSITORY_PORT`
directamente para el endpoint de lectura (`GET /tasks/projects/:id/issues`), mientras que el
endpoint de sync sí pasaba por `TasksService`. Es decir, había **dos caminos distintos** para llegar
a los datos: uno pasando por el caso de uso, y otro saltándoselo.

**Por qué importaba:** si mañana hay que agregar una regla (autorización, logging, validación) a
"listar issues de un proyecto", con ese código había que acordarse de que ese endpoint en particular
no pasaba por `TasksService` — la regla se podía agregar en el lugar equivocado sin que nada avisara
del error.

**Cómo se arregló:** se agregó `TasksService.getIssuesByProject(projectId)`, y el controller dejó de
importar nada de `domain/ports` — su única dependencia pasó a ser `TasksService`.

**Checklist:** si un archivo dentro de `tasks.controller.ts` (o cualquier controller) importa algo
de `domain/ports/*`, está mal.

## Regla 3 — Los adaptadores de salida traducen, no orquestan efectos secundarios de otros puertos

**El error real que pasó acá:** `PlaneApiAdapter` (que implementa `TaskSourcePort`, cuya única
promesa es "te doy issues remotas") también inyectaba `ProjectRepositoryPort` y creaba filas de
`Project` en Postgres como efecto secundario de "buscar issues". La firma del puerto
(`getMyIssues(): Promise<RemoteIssueData[]>`) no avisaba en ningún lado que llamar a ese método
también escribía en la base de datos.

**Por qué importaba:** mezclaba dos responsabilidades en un solo lugar de infraestructura (leer de
Plane + escribir en Postgres), y escondía una decisión de negocio ("¿cuándo creamos un proyecto
local nuevo?") dentro de un adaptador, en vez de tenerla visible en el caso de uso.

**Cómo se arregló:** `RemoteIssueData` pasó a incluir `projectExternalId` y `projectName` (datos
crudos, sin resolver), y `PlaneApiAdapter` dejó de depender de `ProjectRepositoryPort` por completo.
Ahora es `TasksService.ensureProject(...)` quien decide cuándo crear un proyecto, usando el puerto
directamente.

**Checklist:** un adaptador de salida (`infrastructure/adapters/`, `infrastructure/repositories/`)
solo debería depender de los puertos que necesita para *su propia* traducción/persistencia, no de
otros puertos "de paso" para resolver lógica que no le corresponde.

## Regla 4 — La capa de aplicación (casos de uso) no vive mezclada con las entidades

**El error real que pasó acá:** `TasksService` (que hace `async/await`, orquesta varios puertos)
vivía directamente en `domain/`, en el mismo nivel que `entities/` (que son síncronas y sin efectos
secundarios).

**Por qué importaba:** alguien nuevo que abriera `domain/` iba a asumir que todo ahí es sincrónico y
libre de efectos secundarios (como las entidades) — hasta leer `tasks.service.ts` y darse cuenta de
que no.

**Cómo se arregló:** se movió a `domain/application/tasks.service.ts`, en su propia subcarpeta,
separada de `entities/` y `ports/`.

## Regla 5 — Un módulo de NestJS tiene que registrar explícitamente todo lo que usa

**El error real que pasó acá (dos veces, en dos niveles distintos):**

1. Primero, `TasksModule` nunca se importaba en `AppModule` — el módulo entero de tasks estaba
   "flotando", desconectado de la aplicación.
2. Después de arreglar eso, apareció un segundo nivel del mismo problema: `TasksModule` no tenía
   `controllers: [TasksController]` en su `@Module({...})`, y tampoco tenía `TasksService` en
   `providers`.

**Por qué importaba:** NestJS solo registra las rutas HTTP de los controllers que aparecen
explícitamente en el array `controllers` de algún módulo importado (directa o indirectamente) desde
`AppModule`. Si un controller no está listado ahí, sus rutas **no existen** — y no hay ningún error
visible al arrancar la aplicación que te avise de esto; simplemente el endpoint no responde.

**Cómo evitarlo:** cada vez que agregues un controller o un service nuevo, verificá que estén
declarados en el `@Module({...})` correspondiente:

```ts
@Module({
  controllers: [TasksController],   // ← todos los controllers del módulo
  providers: [
    TasksService,                   // ← los casos de uso también son providers
    { provide: TASK_SOURCE_PORT, useClass: PlaneApiAdapter },
    // ... el resto de los puertos
  ],
})
export class TasksModule {}
```

Y que el propio módulo esté en el array `imports` de `AppModule` (o de otro módulo que sí esté
importado desde ahí).

## Checklist rápido para revisar cualquier Pull Request

- [ ] ¿Algo en `domain/entities/` o `domain/ports/` importa una librería de infraestructura
      (TypeORM, Axios, etc.)? → mal.
- [ ] ¿Un controller importa algo de `domain/ports/*`? → mal, debería pasar por un caso de uso.
- [ ] ¿Un adaptador de salida depende de un puerto que no necesita para su propia traducción? →
      revisar si esa lógica debería estar en el caso de uso.
- [ ] ¿Agregaste un controller o un service nuevo? → verificá que estén en `controllers`/`providers`
      del módulo, y que el módulo esté importado desde `AppModule`.
- [ ] ¿Agregaste un puerto nuevo? → verificá que tenga su `Symbol` de inyección y que esté
      registrado en `tasks.module.ts` con `useClass`.
