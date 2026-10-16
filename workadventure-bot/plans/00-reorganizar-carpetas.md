# 00 - Reorganizar carpetas (HECHO)

> Aplicado el 2026-10-15. Además de las carpetas: `.env` (`src/config.mjs`), logs por función (`src/logger.mjs`, `logs/<run>/`), `bot.mjs` partido en módulos y registro de latencia por turno. Ver el README del proyecto.

**Solo mover archivos y arreglar rutas. Sin cambios de lógica.** Va en un único commit, antes que el resto de planes.

## Estructura destino
```
src/      bot, brain, listen, voice, position
config/   zones.json, characters.json
tools/    make-voice-samples, bench-stt, run-variant.sh, speak.ps1
test/     *.test.mjs (npm test) y manual/ (test-human, test-loopback*, test-stt)
out/      capturas y logs (ignorado)
data/     datos en ejecución (ignorado)
```

## Cambio
1. Mover cada archivo a su carpeta (el proyecto no estaba rastreado por git, así que sin `git mv`).
2. Actualizar imports relativos, la ruta por defecto de `zones.json` / `characters.json` (`WA_ZONES` sigue funcionando) y los `SHOT` / log a `out/`.
3. package.json: `"start": "node src/bot.mjs"` y `"test": "node --test test/*.test.mjs"`.
4. `.gitignore`: sustituir `*.png`, `*.log` por `out/` y añadir `data/`.
5. README: actualizar comandos y rutas.

## Tests
- `npm test` ejecuta sin errores (aún sin tests: crear `test/smoke-imports.test.mjs` que importe cada módulo de `src/`; falla si una ruta quedó mal).
- `npm start` con `RUN_SECONDS=20`: entra a la sala y sale sin errores de import. **[manual]**
- `node test/manual/test-loopback.mjs "hola"` sigue transcribiendo. **[manual]**
- `git status` no muestra archivos sin rastrear de `out/` ni de `data/`.

## Hecho cuando
Los 4 puntos pasan y `git log --follow src/bot.mjs` conserva el historial.
