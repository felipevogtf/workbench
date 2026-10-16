# 03 - Decodificar chat del WebSocket

**Requiere:** plan 02 (fixtures y ruta de campos).

## Cambio
1. Extraer `fields()` y `sub()` de [position.mjs](../src/position.mjs) a `src/proto.mjs` y reutilizarlos en ambos módulos.
2. Nuevo `src/chat-ws.mjs` con `decodeChat(buf)` -> `{ from, text } | null`. Nunca lanza: un frame desconocido devuelve `null`.

## Tests (`test/chat-ws.test.mjs`, solo fixtures, sin red)
- Cada frame de chat de `test/fixtures/frames/` devuelve el `text` esperado.
- Texto con tilde y emoji se decodifica sin corromperse.
- Frame de posición, frame vacío y bytes aleatorios devuelven `null`.
- Regresión (`test/position.test.mjs`): un frame de posición conocido sigue dando `{x, y}` tras extraer `src/proto.mjs`.

## Hecho cuando
Todos los tests pasan y `position.mjs` no cambió de comportamiento.
