# 5. Cómo se conecta todo en runtime: inyección de dependencias

Hasta acá vimos que `TasksService` depende de `IssueRepositoryPort` (una interfaz), no de
`TypeOrmIssueRepository` (la clase concreta). Pero en algún lugar, cuando el programa realmente
corre, alguien tiene que decidir "cuando `TasksService` pida un `IssueRepositoryPort`, dale una
instancia de `TypeOrmIssueRepository`". Ese "alguien" es NestJS, y este capítulo explica cómo se le
dice qué hacer.

## El problema: las interfaces de TypeScript desaparecen al compilar

Esto es lo más contraintuitivo de todo el patrón, así que vale la pena explicarlo despacio.

Cuando escribís TypeScript, `interface IssueRepositoryPort { ... }` es solo información para el
compilador. Cuando ese código se compila a JavaScript (lo que realmente corre en Node), **las
interfaces desaparecen por completo** — no dejan ningún rastro en el JS final. Esto es distinto a
las clases: una `class TypeOrmIssueRepository { ... }` sí existe en el JavaScript compilado, porque
una clase es tanto un tipo (para TypeScript) como un valor real (una función constructora) en
tiempo de ejecución.

Esto importa porque NestJS arma sus dependencias **en tiempo de ejecución**, mirando qué existe en
el JavaScript ya compilado. Si `TasksService` dijera simplemente:

```ts
constructor(private readonly issueRepository: IssueRepositoryPort) {}
```

...sin nada más, NestJS no tendría forma de saber qué instancia darle: en el JS compilado no queda
ningún rastro de que ese parámetro se llamaba "IssueRepositoryPort" — la interfaz ya no existe.

## La solución: un token explícito

Por eso, cada archivo de puerto exporta, además de la interfaz, un identificador que **sí** existe
en tiempo de ejecución. En este proyecto se usa `Symbol`:

```ts
// src/tasks/domain/ports/issue-repository.port.ts
export interface IssueRepositoryPort { /* ... */ }

export const ISSUE_REPOSITORY_PORT = Symbol('ISSUE_REPOSITORY_PORT');
```

Un `Symbol` es un valor único de JavaScript que sí sobrevive a la compilación — es real en runtime.
Con esto, `TasksService` puede pedir "denme lo que sea que esté registrado bajo el token
`ISSUE_REPOSITORY_PORT`", y **por separado**, seguir usando `IssueRepositoryPort` como el tipo de
ese parámetro (solo para que TypeScript te avise si usás mal el objeto):

```ts
// src/tasks/domain/application/tasks.service.ts
constructor(
  @Inject(ISSUE_REPOSITORY_PORT)
  private readonly issueRepository: IssueRepositoryPort,
) {}
```

El decorador `@Inject(ISSUE_REPOSITORY_PORT)` le dice a NestJS *qué instancia buscar* (usando el
token que sí existe en runtime). El tipo `IssueRepositoryPort` le dice a TypeScript *qué forma tiene
ese objeto* (para que autocompletado y chequeo de tipos funcionen). Son dos mecanismos separados
que se usan juntos.

> Nota técnica: vas a ver que el import se escribe como
> `import { ISSUE_REPOSITORY_PORT, type IssueRepositoryPort } from '...'`. La palabra `type` ahí
> le dice al compilador "esto es solo para chequeo de tipos, no generes ningún código para esto" —
> es necesario porque este proyecto tiene activada una opción de TypeScript
> (`isolatedModules` + `emitDecoratorMetadata`) que exige distinguir explícitamente qué de un
> import es un tipo y qué es un valor real, cuando ese import se usa en un parámetro decorado.

## Dónde se ata todo: `tasks.module.ts`

Este es el único archivo que menciona **tanto** el token del puerto **como** la clase concreta que
lo implementa:

```ts
@Module({
  providers: [
    { provide: TASK_SOURCE_PORT, useClass: PlaneApiAdapter },
    { provide: ISSUE_REPOSITORY_PORT, useClass: TypeOrmIssueRepository },
    { provide: PROJECT_REPOSITORY_PORT, useClass: TypeOrmProjectRepository },
    { provide: STATE_REPOSITORY_PORT, useClass: TypeOrmStateRepository },
    { provide: LABEL_REPOSITORY_PORT, useClass: TypeOrmLabelRepository },
  ],
})
export class TasksModule {}
```

Se lee así: *"cuando algo pida el token `ISSUE_REPOSITORY_PORT`, instanciá `TypeOrmIssueRepository`
y dáselo"*. Ningún otro archivo del proyecto necesita saber que `TypeOrmIssueRepository` existe —
ni `TasksService`, ni el controller. Si algún día reemplazás Postgres por otra base de datos,
escribís una nueva clase que implemente `IssueRepositoryPort` y cambiás **una sola línea**, acá.

## ¿Y si en vez de un puerto es un service normal?

Vale aclarar: **no todo necesita este mecanismo de token**. Si una clase no representa una
abstracción/interfaz sino que se usa siempre por su clase concreta (por ejemplo, si tuvieras un
`EmailService` normal, sin interfaz de por medio), no hace falta ningún `Symbol` ni `@Inject`:

```ts
@Injectable()
export class EmailService { /* ... */ }

// en otro lado:
constructor(private readonly emailService: EmailService) {}
```

Esto funciona directamente porque, como dijimos, las **clases sí existen en runtime** — la clase
misma sirve como su propio "token". El patrón con `Symbol` + `@Inject` solo hace falta cuando querés
que el código dependa de una **interfaz** (para poder cambiar la implementación sin tocar quien la
usa), que es exactamente el caso de los puertos.

Seguimos con un tutorial práctico en
**[06-como-agregar-una-funcionalidad.md](./06-como-agregar-una-funcionalidad.md)**.
