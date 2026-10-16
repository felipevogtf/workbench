# 05 - Test de humo de selectores

**Requiere:** plan 01 (`findMicButton`).

**Objetivo:** que un cambio de UI de WorkAdventure falle aquí con un mensaje claro y no en medio de una conversación.

## Cambio
`tools/smoke.mjs` **[manual]**: entra a `WA_MAP_URL` y comprueba uno por uno, imprimiendo OK/FALLA:
- campo de nombre (`input[name="fname"]`)
- botones de aleatorio y siguiente
- canvas del juego
- botón de micrófono (`findMicButton`)
- entrada de la burbuja de chat y su caja de texto
- que llega al menos un frame de posición decodificable por WebSocket

Sale con código 1 si algo falla y lista cuáles.

## Tests
- Contra la sala real: todo OK.
- Prueba negativa: `WA_CHAT_INPUT_SELECTOR=nope` debe fallar y nombrar ese selector.
- Ejecutarlo tras cada actualización de WorkAdventure, o una vez por semana.

## Hecho cuando
Pasa en verde y la prueba negativa falla con el nombre correcto.
