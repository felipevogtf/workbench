# Problemas de arquitectura hexagonal pendientes

Esta carpeta documenta violaciones **reales, ya identificadas** al patrón hexagonal que sigue el
resto del proyecto (ver [`../07-reglas-y-errores-comunes.md`](../07-reglas-y-errores-comunes.md)
para los errores que ya se corrigieron). A diferencia de esa carpeta, estos **todavía no están
arreglados** — cada archivo es un plan de corrección para aplicar tal cual.

No son bugs funcionales (el código compila, pasa lint, y funciona). Son decisiones de diseño que
rompen la regla de que **cada contexto acotado (`tasks`, `kanban`, `time-tracking`) solo se
comunica con sus vecinos a través de un puerto propio**, nunca importando el puerto ajeno
directamente.

## Orden recomendado

1. **[01-kanban-acoplado-a-tasks.md](./01-kanban-acoplado-a-tasks.md)** — El más importante. Kanban
   importa directamente los puertos de dominio de `tasks`. Es la causa raíz de la que se
   desprenden el problema 2 y parte del 3.
2. **[02-time-tracking-sin-validacion-cruzada.md](./02-time-tracking-sin-validacion-cruzada.md)** —
   El mismo problema de fondo (una referencia a un `Issue` ajeno) resuelto del lado opuesto:
   `time-tracking` no valida nada y deja que Postgres reviente con un error de FK.
3. **[03-puerto-nextpositionincolumn-huerfano.md](./03-puerto-nextpositionincolumn-huerfano.md)** —
   Un método de puerto declarado, con una implementación que no hace lo que dice, y una
   reimplementación duplicada en la capa de aplicación que sí funciona.
4. **[04-nextlocalid-fuga-infraestructura.md](./04-nextlocalid-fuga-infraestructura.md)** — Un
   método de puerto que expone un detalle de generación de secuencia, y que además nadie llama.
5. **[05-asimetria-adaptadores-http.md](./05-asimetria-adaptadores-http.md)** — Cosmético pero
   sistemático: los controllers no viven en `infrastructure/` como sí lo hacen los repositorios y
   adapters de salida, en los 3 módulos.

## Cómo usar cada archivo

Cada uno tiene la misma estructura: **contexto** (qué archivos y líneas), **el problema** (qué
regla de hexagonal rompe y por qué importa), **la solución** (pasos concretos con código), y un
**checklist** para saber cuándo quedó bien. Podés corregirlos en cualquier orden — no son
prerequisito uno del otro, salvo donde se indica explícitamente.

Después de corregir cada uno, correr:

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint "src/**/*.ts"
```
