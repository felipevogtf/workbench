# Planes

Un archivo = una funcionalidad = sus tests. Hacer el 00 primero: los demás usan las rutas nuevas (`src/`, `tools/`, `test/`, `data/`).

| # | Plan | Depende de |
|---|------|-----------|
| 00 | [Reorganizar carpetas](00-reorganizar-carpetas.md) (hecho, con .env y logs por función) | - |
| 01 | [Micrófono por rol](01-mic-por-rol.md) | - |
| 02 | [Capturar frames de chat](02-capturar-frames-chat.md) | - |
| 03 | [Decodificar chat del WebSocket](03-decodificar-chat-ws.md) | 02 |
| 04 | [Bot lee chat por WebSocket](04-bot-lee-chat-ws.md) | 03 |
| 05 | [Test de humo de selectores](05-test-humo-selectores.md) | 01 |
| 06 | [Almacén de memoria por persona](06-memoria-almacen.md) | - |
| 07 | [Resumen al cerrar conversación](07-memoria-resumen.md) | 06 |
| 08 | [Memoria en el prompt](08-memoria-en-prompt.md) | 06 |
| 09 | [Puente con el mapa (WA.*)](09-puente-mapa.md) | mapa propio |
| 10 | [Script de instalación de Piper](10-setup-piper.md) | 00 |
| 11 | [Conocer el mapa (colisiones y áreas)](11-mapa-colisiones.md) (hecho) | 00 |

Convención de tests: `node:test` (sin dependencias), archivos `test/*.test.mjs`, se ejecutan con `npm test`
(el plan 00 añade `"test": "node --test test/*.test.mjs"` a package.json). Los tests que necesitan WorkAdventure real
se marcan **[manual]** y no van en `npm test`.
