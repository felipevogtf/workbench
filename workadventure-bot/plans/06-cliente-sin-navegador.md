# 06 - Cliente sin navegador (investigación)

**Conclusión: es viable.** Un proceso Node puede entrar a la sala, moverse, entrar a una burbuja, leer el chat y recibir el audio de la
otra persona hablando el mismo protocolo que el navegador, sin Chromium. Probado con datos reales; lo que falta está al final.

## Qué se probó (código en `research/no-browser/`)
| Paso | Resultado |
|---|---|
| Entrar a la sala (`connect.mjs`) | OK. Recibe `roomJoinedMessage` y el movimiento de todos los jugadores. |
| Moverse (`userMovesMessage`) | OK. Basta con enviar la posición; el bot se colocó junto a otro jugador. |
| Entrar a la burbuja | OK. El servidor manda `joinSpaceRequestMessage`; se responde con `joinSpaceQuery` + `updateSpaceUserMessage`. |
| Chat de la burbuja | OK. Llega como `publicEvent` → `spaceMessage { message }` (y `spaceIsTyping`). Sin navegador, leerlo es trivial. |
| Audio con 1 persona (WebRTC punto a punto) | OK. Conexión establecida en ~1 s, audio crudo recibido, Whisper transcribió **sin errores** la grabación `2.m4a`. |
| Memoria | 93 MB el proceso sin navegador. El bot con Chromium es del orden de cientos de MB por bot. |

## Cómo funciona el protocolo
1. `POST {pusher}/anonymLogin` → `authToken` (JWT anónimo). Pusher de la versión hospedada: `https://pusher.workadventu.re`.
2. `GET {pusher}/woka/list?roomUrl=…` (cabecera `Authorization`) da las skins; sirve cualquier `characterTextureIds` válido.
3. WebSocket `wss://pusher…/ws/room?roomId=<url de la sala>&characterTextureIds=…&version=<hash>&chatID=&roomName=&cameraState=…&tabId=<uuid>&connectionId=<uuid>`,
   con el **token como subprotocolo** WebSocket.
4. Cada trama es un sobre protobuf `{ nonce, message }` (`FrontToPusherWebSocketMessage` / `PusherToFrontWebSocketMessage`); el nonce sube de 1 en cada sentido.
5. Primer mensaje: `joinRoomFrontMessage { name, positionMessage, viewportMessage, availabilityStatus }`.
6. Esquema: `messages/protos/messages.proto` del repositorio de WorkAdventure (protobufjs lo carga tal cual, con los `google/protobuf/*.proto`).
7. Audio de burbujas de 2 personas: `privateEvent` con `webRtcStartMessage` (quién inicia) y `webRtcSignal` (JSON de **simple-peer**: offer/answer/candidate).
   Servidores ICE: `queryMessage { iceServersQuery }`. En el bot: `@roamhq/wrtc` + `simple-peer`; el audio entra por `RTCAudioSink` (PCM 48 kHz) y sale por `RTCAudioSource`.
8. Burbujas más grandes usan **LiveKit**: llega un `privateEvent` con `livekitInvitationMessage { token, serverUrl }`. Hay cliente Node (`@livekit/rtc-node`, carga bien en Windows). **No probado**: no se llegó a formar una burbuja grande.

## Trampas encontradas
- **Hash de versión** (`version=`): el servidor rechaza uno distinto. El del repositorio dice `"dev"`; el real se inyecta al compilar. Se lee del JavaScript público del sitio (`GameManager-*.js`, variable `Ld="…"`); `connect.mjs` ya lo hace solo. Cambia con cada despliegue de WorkAdventure.
- El navegador de la otra persona **solo manda audio por conexiones creadas con su micrófono ya encendido**; no renegocia después. Con una persona real (micrófono encendido) no es problema.
- Los `.proto` del repositorio pueden ir por delante del servidor hospedado; si falla un decode, ver si cambió el esquema.

## Lo que falta para reemplazar al bot con navegador
1. **Hablar**: empujar PCM a `RTCAudioSource` (10 ms por trama a 48 kHz). Es la API estándar de wrtc, pero **no se probó** que la otra persona lo oiga.
2. Escribir en el chat: enviar un `publicEvent` con `spaceMessage` (formato leído en el cliente, sin probar).
3. Caminar hacia la gente sin teletransportarse (enviar pasos de `userMovesMessage`) y respetar `zones.json`; las posiciones de todos ya llegan.
4. Elegir skin (hoy usa una fija) y nombre; reconexión con el nonce/`lastReceivedNonce`.
5. Cerrar la burbuja de LiveKit para grupos de 3 o más.
6. Reutilizar lo que ya existe: Whisper (`src/listen.mjs`), voces (`src/voice.mjs`), cerebro (`src/brain.mjs`), zonas y personajes.
7. Pruebas de humo contra la sala real y un chequeo automático del hash de versión al arrancar.

## Riesgos
- **Fragilidad**: es un protocolo interno no documentado; cada actualización de WorkAdventure puede romper algo (el hash de versión es lo más probable).
- **Términos de uso**: pensado para tu propia sala. En salas ajenas o a gran escala, revisar los términos de WorkAdventure.
- Salas con **login obligatorio** (`DISABLE_ANONYMOUS`) necesitarían una cuenta, no el acceso anónimo.

## Cuándo conviene
Si sigues con 1 a 3 bots, el de navegador basta. El cliente sin navegador vale la pena desde ~5 bots a la vez o en un servidor pequeño: no dibuja el mapa, no tiene los problemas de audio del navegador (ni el de los iframes) y consume una fracción de memoria.
