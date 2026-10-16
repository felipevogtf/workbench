# 10 - Script de instalación de Piper

**Requiere:** plan 00.

**Problema:** `piper/` (159 MB) no está en git y hoy se instala a mano. `npm run setup` solo instala Chromium.

## Cambio
1. `tools/setup-piper.mjs`: descarga el binario de Piper y las voces `es_MX-claude-high` y `es_MX-ald-medium` en `piper/` solo si faltan.
2. Verifica el tamaño o el hash de cada archivo y sale con código 1 si no coincide.
3. Una prueba final sintetiza "hola" y comprueba que el WAV tiene duración mayor que 0.
4. `npm run setup` ejecuta Chromium y este script.

## Tests
- Unit (`test/setup-piper.test.mjs`, descarga simulada): con todo presente no descarga nada; con una voz ausente descarga solo esa; con hash incorrecto falla y no deja el archivo a medias.
- **[manual]** Borrar `piper/` y ejecutar `npm run setup`: `node tools/make-voice-samples.mjs` genera los WAV.

## Hecho cuando
Un clon limpio llega a una voz funcional con `npm install && npm run setup`.
