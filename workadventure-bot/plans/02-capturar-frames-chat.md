# 02 - Capturar frames de chat

**Problema:** no se conoce la forma protobuf del mensaje de chat. Hay que observarla antes de decodificar, como se hizo con la posición (ver cabecera de [position.mjs](../src/position.mjs)).

## Cambio
1. Script `tools/dump-frames.mjs`: abre la sala, escucha `framesent` y `framereceived` del WebSocket y guarda cada frame binario en `test/fixtures/frames/<direccion>-<n>.bin`, con un `index.json` (hora, tamaño, dirección).
2. Opción `MARK=1`: imprime la hora cada vez que se pulsa Enter, para relacionar "escribí hola" con un frame concreto.

## Procedimiento **[manual]**
1. Dos clientes en la misma burbuja (`test/manual/test-human.mjs` o tú mismo).
2. Enviar mensajes conocidos: `hola-1`, `hola-2` y uno con tilde y emoji.
3. Localizar los frames que contienen ese texto en UTF-8 (`Buffer.includes`) y anotar la ruta de campos.

## Entregable
- `test/fixtures/frames/` con al menos 3 frames de chat entrantes y 1 saliente.
- `test/fixtures/frames/README.md` con la ruta de campos (p. ej. `2 -> 5 -> {1: remitente, 2: texto}`).

## Hecho cuando
Un frame de cada tipo contiene el texto esperado y la ruta está anotada.
