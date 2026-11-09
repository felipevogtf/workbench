# Planificador editable

Estado: **las tres fases están hechas** (2026-11-09), sin desplegar.

Mejoras al planificador de la tarea, el que genera el plan antes de ejecutar. No tiene relación con Lucy ni con el rediseño de las ejecuciones: es un cambio aparte.

## El problema

- Para planificar hay que pulsar el botón de IA del encabezado de la tarea. Si antes quieres aclarar el ticket, la conversación se hace en el chat de la tarea, un panel apretado.
- Cada vez que pides un cambio, la IA vuelve a escribir **el plan entero** («Replanificar con esta conversación»), aunque solo cambie una línea. Lo genera una llamada a Claude en el servidor y tarda minutos.
- Mientras se genera no se ve nada del plan; aparece al final.

## Cómo es hoy

- El plan es un texto markdown completo (`content`). Lo genera el **servidor**, que lanza `claude -p` él mismo (`ClaudeCliAgentRunnerAdapter`); el runner no interviene. Pasa por los estados pendiente, generando y listo.
- El organizador ya existe como pantalla completa: chat a un lado, panel de tickets, plan y botón «Crear plan» o «Replanificar». Está pensado para grupos de tickets, que se componen como una tarea-grupo aparte.

## Lo que se quiere

1. La tarea tiene un botón **«Planificar»** que abre el organizador con el ticket cargado. Ahí se conversa para aclarar el ticket y, cuando se quiere, se pide el plan.
2. Cuando la IA modifica el plan, el **visualizador del markdown refleja los cambios** al instante, sin recargar.
3. Cuando se piden cambios, la IA **edita las líneas que hacen falta** en vez de crear el plan de nuevo.

## Decisiones tomadas

- **Un ticket solo no crea un grupo.** El organizador trabaja sobre la tarea del propio ticket. Un grupo cambia el nombre de la rama y, según las reglas del organizador, un ticket miembro de un grupo abierto no se puede planificar ni ejecutar por separado. Si después se suma otro ticket, la sesión pasa a ser un grupo.
- **Edición por parches sobre el markdown**, no un plan en pasos estructurados. Es mucho más pequeño, el plan sigue siendo texto libre y la creación de los tickets internos sigue leyéndolo igual. La IA responde con el fragmento que cambia y el servidor lo aplica.

## Orden de ejecución

Cada fase se puede entregar y probar sola.

### Fase 1 · Botón «Planificar» y organizador sobre la tarea

1. **Botón «Planificar»** en la página de la tarea. Abre el organizador con el ticket ya cargado.
2. **Sesión sobre la tarea.** Si la tarea ya tiene una sesión del organizador, se abre esa; si no, se crea una sin tarea-grupo, enlazada a la tarea del ticket. El chat lee el ticket, sus adjuntos y el código de los repos de las etiquetas, como el chat de tareas de hoy.
3. **Plan y ejecución sobre la misma tarea.** «Crear plan» y «Ejecutar» usan la tarea del ticket, así la rama y la PR no cambian de nombre.
4. **Sumar tickets** después convierte la sesión en un grupo, como hoy.
5. **Tests:** crear la sesión desde una tarea, reabrirla sin duplicar, y que planificar y ejecutar sigan funcionando sobre el ticket.

Listo cuando: desde una tarea se pulsa «Planificar», se abre el organizador con el ticket, se conversa y se crea el plan, sin crear un grupo.

### Fase 2 · Plan por parches

1. **Formato del parche.** La IA responde con bloques «reemplaza este fragmento por este otro». Pueden ser varios en una respuesta. El servidor los aplica al markdown del plan.
2. **Validación.** Si un fragmento no aparece en el plan o aparece más de una vez, el parche se rechaza y se le devuelve el error a la IA para que lo corrija, sin tocar el plan.
3. **Cuándo se usa.** Con un plan ya listo, «Replanificar» pasa a pedir parches. La IA solo regenera el plan completo si se lo pides o si el plan no existe todavía.
4. **Versiones.** No hizo falta una tabla nueva: cada replanificación ya era una fila de plan nueva con `basedOnPlanId`, así que cada edición es una versión más del historial y la anterior queda intacta.
5. **Respaldo.** Si los bloques no entran, se le dice a la IA qué falló y los corrige (hasta 2 intentos); como último recurso entrega el plan completo. `SIN CAMBIOS` deja el plan igual.
6. **Tests:** aplicar un parche, parche que no coincide, parche ambiguo, varios parches seguidos y volver a la versión anterior.

Listo cuando: pedir un cambio puntual modifica solo esas líneas del plan, en segundos, y el resto queda igual.

### Fase 3 · El visualizador refleja los cambios

1. **La pantalla se actualiza sola.** Cuando el servidor aplica un parche, el visualizador del plan muestra el markdown nuevo sin recargar la página ni pulsar nada.
2. **Resaltado de lo cambiado.** Las líneas modificadas o añadidas se marcan unos segundos para ver qué tocó la IA. Se calcula comparando la versión anterior (que ya guarda la fase 2) con la nueva.
3. **Aviso mientras trabaja.** Mientras la IA prepara los parches se ve que está trabajando; el plan actual sigue visible y no se vacía.
4. **Tests:** al aplicarse un parche el store del plan recibe el contenido nuevo, y el cálculo de las líneas cambiadas es correcto.

Listo cuando: pides un cambio en el chat y, al terminar la IA, el visualizador muestra el plan modificado con lo cambiado resaltado, sin recargar.

## Riesgos a vigilar

- **Cómo se entera la pantalla.** Si hoy el store del plan consulta cada cierto tiempo, el cambio llega con ese retraso; si hace falta más inmediatez, se puede avisar con un evento del servidor. Se decide al hacer la fase.
- **Parches que no coinciden.** Es el fallo más probable de la fase 2. Conviene que el mensaje de error a la IA diga qué fragmento no se encontró.
- **Despliegue.** Todo vive en el servidor: no hay que tocar ni reiniciar el runner.
