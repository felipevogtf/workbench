# 06 - Almacén de memoria por persona

## Cambio
`src/memory.mjs` sin dependencias, un JSON por persona en `data/memory/<id>.json`: `{ id, name, summary, facts: [], updated }`.
API: `load(id)`, `save(id, data)`, `forget(id)`.
`id` = nombre en minúsculas saneado (solo `a-z0-9-_`). Si más adelante hay login se cambia a UUID sin tocar el resto.
`data/` se añade a `.gitignore` (son datos de terceros).

## Tests (`test/memory.test.mjs`, carpeta temporal del sistema)
- `load` de una persona inexistente devuelve un objeto vacío, no lanza.
- `save` y `load` devuelven lo mismo (incluye tilde y emoji).
- Un nombre malicioso (`../../x`, `con/barra`) no escribe fuera de `data/memory/`.
- `forget` borra el archivo y un `load` posterior devuelve vacío.
- Archivo corrupto: `load` devuelve vacío y conserva una copia `.bad`.

## Hecho cuando
Los 5 tests pasan. Este plan no toca `bot.mjs`.
