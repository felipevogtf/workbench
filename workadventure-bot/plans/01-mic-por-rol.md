# 01 - Micrófono por rol

**Problema:** el botón del mic se localiza con `elementFromPoint(436, 47)` ([bot.mjs:209-220](../src/bot.mjs#L209-L220)) y depende del viewport.
La verificación (clase `bg-danger` + 3 reintentos) ya existe y se conserva.

## Cambio
1. Nuevo `src/mic.mjs` con `findMicButton(page)`: `page.getByRole("button", { name: /micr|mic/i })`.
2. Si no hay resultado, fallback a la coordenada actual y `log("mic: fallback por coordenada")`.
3. `micOn()` y el bucle de clic usan ese localizador. El resto del flujo no cambia.

## Tests (`test/mic.test.mjs`, Playwright con `page.setContent`)
- Botón con `aria-label="Micrófono"` en viewport 1280 y en 800: se encuentra en ambos.
- Botón en inglés (`aria-label="Microphone"`): se encuentra.
- Sin botón con nombre pero con uno en (436,47): usa el fallback y lo registra.
- Sin ningún botón: devuelve `null` (no lanza).
- **[manual]** `HEADED=1 npm start`: el log dice `mic ON (unmuted)` sin pasar por el fallback.

## Hecho cuando
Los 4 tests pasan y el log manual no muestra el fallback.
