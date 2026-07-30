# Arquitectura Hexagonal en este proyecto

Esta carpeta explica, desde cero, cómo está armado `workbench-server` y por qué. Está pensada
para alguien que **nunca escuchó hablar de arquitectura hexagonal** y necesita entender el
proyecto para poder trabajar en él.

No hace falta leer todo de una — está ordenado como un camino:

1. **[01-que-es-esto.md](./01-que-es-esto.md)** — Qué problema resuelve esta arquitectura y el
   vocabulario mínimo (dominio, puertos, adapters). Empezá por acá.
2. **[02-mapa-del-proyecto.md](./02-mapa-del-proyecto.md)** — Carpeta por carpeta, qué hay adentro
   y con qué concepto de la teoría se corresponde.
3. **[03-flujo-sync.md](./03-flujo-sync.md)** — Seguimos, archivo por archivo, qué pasa cuando se
   llama a `POST /tasks/sync`. Es el ejemplo más completo del proyecto.
4. **[04-flujo-lectura.md](./04-flujo-lectura.md)** — Lo mismo pero para `GET
   /tasks/projects/:id/issues`, un caso más simple.
5. **[05-inyeccion-de-dependencias.md](./05-inyeccion-de-dependencias.md)** — Cómo NestJS conecta
   todas las piezas en runtime (los `Symbol`, el `tasks.module.ts`).
6. **[06-como-agregar-una-funcionalidad.md](./06-como-agregar-una-funcionalidad.md)** — Tutorial
   paso a paso para agregar algo nuevo siguiendo el mismo patrón.
7. **[07-reglas-y-errores-comunes.md](./07-reglas-y-errores-comunes.md)** — Checklist de "esto sí,
   esto no", con errores reales que se cometieron en este proyecto y cómo se corrigieron.

## Resumen en un párrafo

El proyecto separa el código en tres capas: **dominio** (las reglas de negocio puras, ej. "un
issue no puede tener fecha de fin antes que la de inicio"), **aplicación** (los casos de uso que
orquestan esas reglas, ej. "sincronizar issues desde Plane"), e **infraestructura** (todo lo que
habla con el mundo exterior: Postgres, la API de Plane, HTTP). El dominio y la aplicación **nunca**
importan nada de infraestructura directamente — hablan a través de interfaces llamadas **puertos**,
e infraestructura provee **adaptadores** que implementan esos puertos. Esto permite, por ejemplo,
cambiar Plane por Jira sin tocar una sola línea de las reglas de negocio.
