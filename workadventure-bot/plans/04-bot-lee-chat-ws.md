# 04 - El bot lee el chat por WebSocket

**Requiere:** plan 03.

## Cambio
1. `trackChat(page)` (en `src/chat-ws.mjs`): `framereceived` -> `decodeChat` -> cola de mensajes.
2. `chatLoop` ([bot.mjs:356](../src/bot.mjs#L356)) consume la cola en lugar de `page.locator(MSG)`.
3. Los mensajes propios se descartan por remitente, no comparando texto (se elimina `ownReplies`).
4. `WA_CHAT_SOURCE=dom` mantiene el método antiguo como fallback durante la transición.

## Tests
- Unit (`test/chat-queue.test.mjs`): una secuencia de frames de fixtures produce los mensajes en orden; uno cuyo remitente es el bot no entra en la cola.
- Unit: dos mensajes iguales ("hola", "hola") producen dos entradas.
- **[manual]** Dos clientes: A escribe y el bot responde; el log muestra `chat:` sin tocar el DOM. Repetir con `WA_CHAT_SOURCE=dom` y comprobar que ambos caminos responden igual.

## Hecho cuando
Los unit pasan y la prueba manual responde por ambos caminos. Retirar el DOM va en otro cambio.
