# 11 - Conocer el mapa (colisiones y áreas) (HECHO)

> Aplicado el 2026-10-15 en `src/map.mjs` y `src/movement.mjs` (tests en `test/map.test.mjs`, herramienta `tools/show-map.mjs`). Además de las paredes, lee las cuadrículas de colisión del mobiliario (77 tiles en la sala `startup`). Validación manual: 4,5 min caminando a ciegas (`WA_MAP=0`), 117 tiles distintos y ninguno cayó en pared ni mueble según el mapa. El desfase de las cuadrículas de mobiliario (origen = esquina superior izquierda de la entidad) no está probado de forma independiente.

**Problema:** el bot no sabe dónde hay paredes ni muebles; solo evita los rectángulos de `config/zones.json`, medidos a mano.

**Verificado:** el mapa se puede descargar sin login (probado el 2026-10-15 con la sala `team-php/startup`):
1. `https://play.workadventu.re/map?playUri=<url de la sala>` devuelve JSON con `wamUrl`.
2. El `.wam` trae `mapUrl` (el `.tmj` de Tiled) y las `areas` (10) y `entities` (117) con posiciones en píxeles.
3. El `.tmj` (45x33 tiles de 32 px) tiene una capa `collisions`.

## Cambio
1. `src/map.mjs`: `loadMap(playUri)` descarga wam + tmj, cachea en `out/map/` y devuelve `{ width, height, tile, blocked(tx,ty), areas }`.
2. `blocked` sale de la capa `collisions` (tile distinto de 0).
3. `movement.mjs` usa `blocked` para no elegir una dirección que choque en 1-2 tiles; `zones.json` sigue para zonas prohibidas.
4. Si la descarga falla, el bot arranca igual como hoy y lo avisa en `system.log`.

## Tests
- Unit (`test/map.test.mjs`, con un `.tmj` y un `.wam` pequeños en `test/fixtures/map/`): una capa 3x3 con un tile bloqueado devuelve `blocked(1,1) === true` y el resto `false`; fuera de rango cuenta como bloqueado.
- Unit: `areas` del wam se convierten a rectángulos en tiles (píxel / 32, redondeando hacia fuera).
- Unit: respuesta sin `wamUrl` o red caída devuelve `null` sin lanzar.
- **[manual]** 5 minutos de `WA_POS_LOG=1`: ninguna posición de `movement.log` cae en un tile bloqueado.

## Hecho cuando
Los unit pasan y el recorrido manual no pisa tiles bloqueados.

## Después (planes aparte)
- Ir a un área por nombre y saludar (recepcionista, ver plan 09).
- Generar `zones.json` desde las áreas del mapa.
- Dar al LLM una descripción del mapa para que guíe a la gente.
