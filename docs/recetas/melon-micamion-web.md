## Stack
Symfony 7.4 + PHP 8.3 (FPM, alpine, imagen propia desde `docker/php/Dockerfile`) + MariaDB + Nginx, todo en Docker. Es el backend de MiCamión: API REST `/api/*` para la app Flutter de conductores, webhooks `/webhooks/*`, y los paneles web `/admin` (EasyAdmin 4), `/supervisor` (Twig + Turbo + Mercure), `/superadmin` y `/qa`. Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. La consola es `bin/console` y el front controller `public/index.php`. La fuente de verdad es el código: `README.md`, `docs/` y `CONTEXT_FOR_BACKEND.md` tienen partes desactualizadas. Las reglas de revisión del repo están en `REVIEW_RULES.md`: léelas.

## Contenedores y puertos
`app` (php-fpm), `nginx`, `cron`, `worker` (consume Messenger) y, opcionalmente, `mercure` (`compose.mercure.yaml`). La base de datos NO está en el compose. WireMock (APIs externas simuladas) está aparte, en `compose.wiremock.yaml` (puerto 8082).
Puertos del host: 8081 (nginx) y 9000 (php-fpm).

## Base de datos MariaDB (contenedor aparte, antes de levantar el resto)
Usa `mariadb:10.11`, usuario `root`, clave `root`. Schemas: `micamion` y `micamion_test`. El `.env` versionado trae un `DATABASE_URL` de PostgreSQL que NO sirve: se sobrescribe en `.env.local`.

## Levantar
Archivos que NO vienen al clonar (.gitignore): `.env.local` y `.env.test.local`. `make env` crea `.env.local` desde `.env` con tu UID/GID.

`.env.local`:
```
DATABASE_URL="mysql://root:root@host.docker.internal:3306/micamion?serverVersion=10.11.2-MariaDB&charset=utf8mb4"
```
`.env.test.local` (en el entorno `test` Symfony NO lee `.env.local`): el mismo `DATABASE_URL` con la base `micamion_test`.

```
make build   # construye la imagen con tu UID/GID
make up      # levanta app, nginx, cron y worker (carga .env.local)
```
`compose.override.yaml` monta tu `~/.ssh` en el contenedor: Composer baja por SSH dos bundles privados de Bitbucket (`superadmin-module`, `notification-module`), así que la llave debe tener acceso. Las integraciones (JDE, Unigis, SOA, Angelis…) apuntan a `host.docker.internal:8082`: levanta WireMock con `make wiremock-up` si las necesitas.

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console doctrine:schema:update --force --env=test
```
NO hay migraciones: el esquema sale de las entidades con `schema:update --force`, también en producción. Por eso un cambio de mapping (renombrar una columna o propiedad, agregar una columna no nula sin valor por defecto, cambiar el valor de un enum guardado) es un cambio de datos en producción: no lo hagas sin decirlo. `make db` además crea los permisos y perfiles base (`app:init-base-data`).

## Probar
- Tests: `docker compose exec app php vendor/bin/phpunit --testsuite Unit` (`make test`) y `--testsuite Integration` (necesita la base `micamion_test`). Un archivo: `… phpunit tests/Unit/Ruta/AlgunTest.php`; uno solo: `--filter nombre`.
- Análisis estático: `docker compose exec app vendor/bin/phpstan analyse` (`make phpstan`, nivel 6). Puede haber errores antiguos: no arregles los de archivos que no tocas ni los reportes como si fueran tuyos.
- Formato: `make cs-check`. No se aplica en el repo: no cambies el estilo del código existente.
- App en http://localhost:8081. Rutas: `docker compose exec app bin/console debug:router`.
- Nginx: configuración en `docker/nginx/default.conf`, montada en el contenedor: `docker compose exec nginx nginx -t` y `… nginx -s reload`.

## Ojo
- Fechas: la base guarda `datetime` en UTC y PHP trabaja en `America/Santiago`. Pasa objetos `DateTimeInterface` a las consultas (no strings formateados) y no uses `NOW()` ni `CURRENT_DATE()` en DQL.
- Los webhooks (`/webhooks/*`) validan `X-Api-Key` como primera instrucción del controlador y deben ser idempotentes. Los mensajes de Messenger llevan solo escalares (IDs), nunca entidades.
- Ignora `vendor/`, `var/`, `notification-module/` (copia local sin versionar), `temp/` y `docs/*.docx`.
- `SQLSTATE[HY000] [2002]`: MariaDB apagada o `DATABASE_URL` mal puesto. `Unknown database`: falta crear el schema.
- Tras cambiar `.env.local`: `docker compose exec app bin/console cache:clear`.
- Un cambio en `docker/php/` exige `make build` y `make up`.

## Si eres un agente
Si tu prompt trae «Entorno de pruebas», el runner ya levantó este proyecto en contenedores propios de tu ejecución: **no ejecutes `docker compose up`, `make up`, `make build` ni los pasos de «Levantar» y «Preparar la base de datos»**. En ese entorno solo está el contenedor `app` (sin nginx, worker, cron, mercure ni WireMock), con MariaDB propia y las bases `micamion` y `micamion_test` creadas, con el esquema aplicado y las dependencias instaladas. Usa `docker compose exec -T app …` (phpunit, phpstan, consola de Symfony). Sin servidor web no hay rutas HTTP que probar: apóyate en los tests y en `bin/console debug:router`. Las integraciones externas no responden: no des por probado lo que depende de ellas. Antes de terminar, corre los tests que toquen lo que cambiaste y `phpstan`. Si algo no queda montado en el contenedor o no hay entorno, no lo des por probado: dilo en tus dudas.
