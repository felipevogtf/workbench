# Etapa 2: Lucy habla con los agentes y ellos con Lucy (anotado, sin implementar)

Acordado el 2026-10-25. Nada de esto está construido todavía; lo que ya existe está al final.

## Qué falta hoy

Cada trabajo de un agente es una llamada de una sola vuelta, sin nadie al otro lado. Un desarrollador o un
revisor con una duda solo puede **adivinar o fallar**. Y el usuario habla con Lucy, pero Lucy no puede
preguntarle nada a los demás, ni ellos a ella.

## La idea

Lucy es la coordinadora. Los demás agentes le preguntan a ella cuando dudan, ella responde sola si el plan lo
dice y, si es una decisión del usuario, **se la escala en el chat**. Lucy también puede mandarle una nota a un
agente. El usuario habla solo con Lucy.

```
David tiene una duda ──► Lucy ──┬─ el plan lo responde ──► respuesta a David, sigue solo
                                └─ es del usuario ───────► te pregunta en el chat ──► tu respuesta ──► David
```

## Flujo 1: un agente le pregunta a Lucy

1. **La pregunta.** Si un desarrollador o revisor no puede seguir sin una respuesta, termina su trabajo con una
   pregunta marcada (por ejemplo, un bloque `PREGUNTA:` al final, o un JSON con `needs`). El prompt le dice
   **cuándo preguntar**: solo si no se resuelve leyendo el plan, el ticket o el código. Y que si puede avanzar
   con un supuesto razonable, avance y lo diga en el resumen.
2. **El servidor la detecta** al terminar el trabajo (`handleFinished`), en vez de darlo por hecho o por fallido:
   - el ticket pasa a un estado nuevo, **«Esperando respuesta»**;
   - la ejecución se pausa (como en «Esperando tu visto bueno») mientras ese ticket bloquee a los demás;
   - se guarda un mensaje en el hilo de la ejecución: quién preguntó, a qué ticket se refiere y el texto.
3. **Lucy decide.** Un trabajo corto de Lucy en el servidor recibe la pregunta, el ticket, el plan, los
   resúmenes y las decisiones anteriores, y responde con una de dos cosas:
   - `RESPUESTA: …` cuando está clara (cita el plan o el ticket en una frase);
   - `ESCALAR: …` con la pregunta ya redactada para el usuario, y su recomendación.
4. **Si responde Lucy**, se guarda como una **decisión del ticket** y el desarrollador retoma con ella en su
   siguiente vuelta (igual que hoy recibe el feedback del revisor). Todo queda visible en el chat.
5. **Si escala**, el usuario ve el mensaje en el chat de Lucy, con el aviso de «sin leer» y la insignia en la
   tarjeta del ticket. Su respuesta se guarda como decisión y el trabajo se retoma.
6. **Topes:** como máximo 2 preguntas por ticket (la tercera vez se avanza con lo mejor que haya, o se falla con
   la pregunta a la vista); y 1 reintento de Lucy si su respuesta no tiene el formato.

## Flujo 2: Lucy le habla a un agente

Los agentes no están «conectados»: solo existen mientras corre su trabajo. Por eso hablarles es:

- **Una nota para su próxima vuelta.** Lucy (o el usuario a través de ella) deja una instrucción en un ticket
  («usa el componente X, no crees uno nuevo»). Se guarda como decisión y se incluye en el prompt del
  desarrollador la próxima vez que trabaje en ese ticket. No interrumpe un trabajo en curso.
- **Pedirle una explicación.** Un trabajo corto con la persona de ese agente (su prompt y su modelo) y el
  contexto del ticket, para que cuente qué hizo y por qué. Es opcional y se paga con una llamada al modelo.

## Qué hay que construir

### Servidor (`executions`)
- **Hilo de mensajes por ejecución** (tabla `execution_messages`): autor (`user`, `lucy` o un agente), texto,
  ticket al que se refiere, tipo (`pregunta`, `respuesta`, `nota`, `decision`) y fecha. Hoy la conversación del
  chat vive solo en el navegador; esto la haría compartida y la haría sobrevivir a una recarga.
- **Estado de ticket `waiting`** y su efecto en la máquina de estados (`advance`/`handleFinished`): un ticket
  esperando respuesta no avanza ni bloquea la cancelación ni el reintento.
- **Detección de la pregunta** en la salida de `develop` y `review` (el parseo ya existe para tickets y
  revisiones; se añade el caso «pregunta»).
- **Trabajo de Lucy para responder** (módulo `task-tickets`, que ya conversa) con su propio prompt corto, tope de
  gasto y un parseo estricto de `RESPUESTA` / `ESCALAR`.
- **Decisiones del ticket** (`ticket.decisions[]`) inyectadas en `buildDevelopPrompt` / `buildReviewPrompt`,
  como hoy el feedback.
- **Endpoints:** leer el hilo, que el usuario responda a una pregunta escalada (`POST
  /executions/:id/answer`) y que deje una nota en un ticket.

### Front
- El chat con Lucy lee y escribe el **hilo del servidor** (hoy es solo del navegador). Se reutiliza el panel
  compartido, el avatar de Lucy en el botón y el aviso de mensajes sin leer, que ya existen.
- Las preguntas escaladas salen como mensajes de Lucy que citan al agente («David pregunta: …») con un campo
  para responder.
- Insignia «Esperando respuesta» en la tarjeta del ticket y una nota arriba de la ejecución.
- En el panel del ticket, pestaña **Actividad**: las preguntas, respuestas y decisiones, en orden.

### Runner
- Nada nuevo: la pregunta llega en la salida normal del trabajo y las decisiones viajan en el prompt.

## Etapa 3 (después): Lucy actúa, con confirmación

Que Lucy pueda **proponer acciones** y el usuario las apruebe con un botón: reasignar un ticket, editar su texto,
añadir o quitar un ticket, reintentar o cancelar. Se deja para el final porque cambia el estado de la ejecución
y necesita confirmación explícita.

## Riesgos y cómo se acotan

- **Preguntas en bucle o por pereza.** Tope de 2 por ticket y un prompt que pide preguntar solo cuando no se
  puede resolver con el plan, el ticket o el código.
- **Lucy responde mal por el usuario.** Debe citar de dónde sale la respuesta y **escalar** ante la duda. El
  usuario ve todo el hilo y puede corregirla con una nota.
- **Cuota.** Cada pregunta suma una llamada corta de Lucy y una vuelta más del agente. Con el tope, el peor caso
  de un ticket es acotado.
- **Respuestas que contradicen el plan.** Lo decidido queda como decisión del ticket y se muestra en la
  actividad; si cambia el alcance, conviene replanificar.
- **La ejecución parada por una pregunta sin respuesta.** Aviso de «sin leer», insignia visible y una nota
  arriba; y se puede cancelar o continuar con un supuesto.

## Orden sugerido

1. Hilo de mensajes por ejecución en el servidor y el chat de Lucy leyéndolo (sin cambiar el flujo de agentes).
2. Estado «Esperando respuesta», detección de la pregunta y escalado al usuario (Lucy siempre escala).
3. Que Lucy responda sola cuando el plan lo dice.
4. Notas de Lucy a un agente y «pedir una explicación».
5. Etapa 3: acciones con confirmación.

## Decisiones abiertas

- **Formato de la pregunta del agente:** un marcador de texto (`PREGUNTA:`) o un JSON. El JSON es más estricto;
  el marcador es más tolerante con los modelos baratos (Rebecca con Haiku).
- **¿Preguntan también los revisores?** Propuesta: sí, pero solo para dudas sobre el alcance del ticket.
- **¿Cuántas decisiones se guardan por ticket** y cuánto del hilo entra en cada prompt? Propuesta: las decisiones
  del ticket completas y las últimas 10 mensajes del hilo.
- **¿Lucy responde sola de entrada o escala siempre al principio?** Propuesta: empezar escalando siempre (paso 2)
  y activar la respuesta automática (paso 3) cuando se vea que sus respuestas son confiables.

## Lo que ya existe y se reutiliza

- Chat con Lucy sobre cada ejecución: conoce el estado, los tickets, el último fallo, el plan y el código del
  repo (rama principal, solo lectura). Es de solo lectura.
- Panel de chat compartido con el avatar del agente en el botón, sombra sutil y aviso de mensajes sin leer
  (contador y latido).
- Un nombre y un avatar por trabajador, y la tabla de trabajadores con filtros.
- Tickets con nivel, desarrollador y revisor asignados, y la pausa «Esperando tu visto bueno» (el estado
  `awaiting` ya sirve de modelo para el nuevo estado de espera).
- Decisiones y feedback inyectados en el prompt del desarrollador (`ticket.feedback`), que es el mecanismo que
  se extiende con `ticket.decisions`.
