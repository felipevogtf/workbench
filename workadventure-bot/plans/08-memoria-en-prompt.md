# 08 - Memoria en el prompt

**Requiere:** plan 06 (funciona sin el 07, con memoria escrita a mano).

## Cambio
1. Al abrir una burbuja, identificar al interlocutor (nombre visible) y `load(id)`.
2. `buildSystem(base, mem)` añade al SYSTEM un bloque "Lo que sabes de esta persona: ..." solo si hay memoria.
3. Comando de olvido: si el usuario escribe "olvídame" o "forget me", se llama a `forget` y el bot lo confirma.

## Tests (`test/prompt.test.mjs`)
- Sin memoria: el prompt es idéntico al actual.
- Con memoria: contiene el resumen y no supera un límite de caracteres.
- "olvídame" borra el archivo y no se envía al LLM como pregunta normal.
- **[manual]** Archivo creado a mano con "le gusta el café": el bot lo usa en la conversación.

## Hecho cuando
Unit en verde y la prueba manual refleja el dato.
