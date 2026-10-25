# workbench-runner

Programa que corre en tu PC y hace el trabajo de las **ejecuciones de tareas** del workbench: clona el
repositorio, deja que los agentes de IA (Claude Code) escriban y revisen el código, hace los commits y
sube la rama por SSH. La app (servidor) decide qué sigue y abre la PR; el runner solo ejecuta.

Siempre es el runner quien llama al servidor (por Tailscale): no abre puertos en tu PC.

## Qué necesita

- **Node 22+**, **Git** y **Claude Code** (`claude`) instalados, con `claude` ya con sesión iniciada.
- Llaves **SSH** con acceso de escritura a los repositorios (el runner usa tu `ssh-agent` o tus llaves de
  siempre, sin pedir contraseña: si la llave tiene frase, cárgala en el agente antes).
- `git config --global user.name` y `user.email` (los commits los firma con tu identidad).

## Puesta en marcha

1. En la app, **Ejecuciones → Runners → Nuevo runner**. Copia el token (solo se muestra una vez).
2. Copia `runner.config.example.json` a `runner.config.json` y completa `token` y `workDir`.
3. `npm install && npm run build`
4. `npm run check`: comprueba git, claude, la carpeta, y que el servidor acepte el token.
5. `npm start`: se queda esperando trabajo. `Ctrl+C` lo detiene (cancela lo que esté haciendo).

## Que arranque solo (Windows)

```
npm run autostart:install
```

Hace dos cosas, las dos solo para tu usuario y sin pedir administrador:

1. **Arranque con Windows:** deja un lanzador en tu carpeta «Inicio». Al iniciar sesión el runner se abre
   solo, **sin ventana**, y deja su salida en `runner.log` (junto al programa; puedes borrarlo).
2. **Enlace `workbench-runner://`:** al pulsar **Ejecutar el plan** en la app, si no hay ningún runner
   conectado, la página abre `workbench-runner://start`, Windows lanza el runner y la app espera a que
   aparezca «Conectado». La primera vez el navegador pregunta si abrirlo: elige _permitir siempre_.

Es seguro lanzarlo de más: si ya hay un runner corriendo en esa carpeta de trabajo (`runner.lock`), el
nuevo avisa y termina. Para deshacerlo: `npm run autostart:remove`. `npm run autostart:install -- --dry-run`
muestra lo que haría sin tocar nada.

El enlace abre el runner **de este PC**, así que conviene que el runner **predeterminado** de la app sea
el de tu PC (el primero que creas lo es; se cambia en _Automatización → Runners → Usar por defecto_).

## Varios runners

- El **predeterminado** toma el trabajo primero. Los demás solo toman trabajo cuando el predeterminado no
  está conectado, así que con varios PCs no se pisan.
- Si revocas el predeterminado, el más antiguo que quede pasa a serlo.

## Configuración (`runner.config.json`)

| Campo             | Para qué                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serverUrl`       | Dirección del servidor con `/api`                                                                                                                                                             |
| `token`           | Token del runner (también `WORKBENCH_RUNNER_TOKEN`)                                                                                                                                           |
| `workDir`         | Carpeta donde se clonan los repos y se crean las ramas de trabajo. Mejor fuera de tus proyectos                                                                                               |
| `claudeBin`       | Ejecutable de Claude (por defecto `claude`)                                                                                                                                                   |
| `maxBudgetUsd`    | Tope de gasto de cada trabajo de un agente (por defecto 5)                                                                                                                                    |
| `timeoutMinutes`  | Tiempo máximo por tipo de trabajo (`tickets`, `develop`, `review`, `publish`)                                                                                                                 |
| `allowedTools`    | Herramientas máximas por tipo de trabajo. **Manda sobre el servidor**                                                                                                                         |
| `remoteOverrides` | `"organización/repo": "<url o ruta>"` para clonar de otra dirección (espejos, pruebas)                                                                                                        |
| `copyFiles`       | `"organización/repo": [{"from": "plantilla", "to": "archivo"}]`: archivos que se copian al worktree nuevo (p. ej. un `environment.ts` que el repo no versiona). Los submódulos se traen solos |

### Qué puede hacer un agente en tu PC

Cada agente recibe solo las herramientas que **el servidor pide y esta lista permite**. Aunque
alguien cambiara los agentes en el servidor, no podrían darles más de lo que pone aquí. Por defecto:

- `tickets` y `review`: leer (`Read`, `Grep`, `Glob`) y `git log/show/diff`.
- `develop`: además editar y crear archivos, instalar dependencias (`npm install`, `npm ci`) y correr
  `npm test`, `npm run test|lint|build`.

  **Ojo con `npm install`:** ejecuta los scripts de instalación de los paquetes que se bajan, es decir, código
  de terceros en tu PC. Hace falta para que el desarrollador pueda compilar y corregir (sin `node_modules`
  no puede), pero si prefieres no darle ese permiso, quítalo en tu `runner.config.json`:

  ```json
  "allowedTools": { "develop": ["Read", "Grep", "Glob", "Edit", "Write", "Bash(npm test:*)"] }
  ```

  Lo que pongas ahí manda sobre lo que pida el servidor.

Nadie hace `git push` salvo el runner, y solo de la rama de la ejecución. El agente trabaja dentro de un
`git worktree` propio en `workDir/worktrees/`, y corre sin tus hooks ni servidores MCP de usuario
(`--setting-sources project`).

## Qué deja en `workDir`

- `repos/<organización>__<repo>`: el clon.
- `worktrees/<rama>`: la carpeta de cada ejecución en curso. Se quita al publicar; las abandonadas
  (más de 7 días) se borran al arrancar.

## Si algo falla

- _El servidor rechazó el token_: revocaste el runner o copiaste mal el token; crea otro.
- _Permission denied (publickey)_: la llave SSH no tiene acceso al repo o no está cargada en el agente.
- _git no tiene user.email_: configura tu identidad de git.
- Sin conexión, el runner reintenta solo con esperas crecientes; al volver sigue donde estaba. Si estuvo
  sin dar señales más de 2 minutos con un trabajo en curso, el servidor lo da por perdido y puedes
  **reintentar** esa etapa desde la app.

## Desarrollo

`npm test` compila y corre las pruebas (con `git` de verdad sobre repos locales y un `claude` de
mentira en `test-support/`).
