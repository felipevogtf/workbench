# 07 - Resumen al cerrar la conversación

**Requiere:** plan 06.

## Cambio
1. `summarize(prev, history, think)` en `src/memory.mjs`: pide al LLM 2-3 líneas que fusionen el resumen anterior con la conversación nueva.
2. `bot.mjs` lo invoca cuando `someoneNear()` pasa a falso tras una conversación (hoy ya detecta "ha dejado la conversación") y guarda el resultado con `save`.
3. Si `think` falla se conserva el resumen anterior y se registra el error.

## Tests (`test/memory-summary.test.mjs`, `think` inyectado como stub)
- Con historial vacío no llama al LLM.
- Pasa a `think` el resumen previo y el historial; guarda lo que devuelve el stub.
- Si el stub lanza, el archivo queda igual que antes.
- Un resumen mayor de N caracteres se recorta.
- **[manual]** Hablar, irse, volver: `data/memory/<nombre>.json` contiene un resumen coherente.

## Hecho cuando
Unit en verde y el archivo manual tiene un resumen razonable.
