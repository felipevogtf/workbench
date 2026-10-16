# 09 - Puente con el mapa (WA.*)

**Solo si el mapa es tuyo.** Opcional: no empezar hasta decidir tener un mapa propio.

## Cambio mínimo
1. Script de mapa (`map/bot-bridge.js`) que, al entrar alguien en la zona `recepcion`, hace `WA.state.saveVariable("visitor", nombre)`.
2. El bot lee esa variable (o recibe el evento) y va hacia la zona o saluda.
3. Solo esta señal. Sustituir `zones.json` por zonas del mapa es un cambio aparte.

## Tests
- **[manual]** Entrar en la zona: la variable cambia y se ve en el log del bot.
- Unit: función que traduce el evento `{zone, name}` a una acción (`greet` o `ignore`): zona conocida, zona desconocida, nombre vacío.
- Prueba negativa: sin el script en el mapa el bot arranca y funciona igual (sin saludo automático, sin error).

## Hecho cuando
El bot saluda a quien entra en la zona y arranca igual en un mapa sin el script.
