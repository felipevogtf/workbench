## Stack
Symfony 3.4 + PHP 7.3 (alpine) + MySQL, todo en Docker. Es MiMixer (el servicio al que apuntan MiObra, MiFlota y MiSeguridad). Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. La consola es `bin/console`; un solo front controller, `web/app.php`. La configuración sale de variables de entorno `APP_*` (archivo `.env.compose.local`), no de `parameters.yml`.

## Contenedores y puertos
Un solo contenedor `app`: trae php-fpm y nginx juntos, construido desde `docker/app/Dockerfile.prod` (la primera vez tarda). Con el compose de mocks, `wiremock` y `swagger`. `supervisor`, `cron` y `nginx` están comentados en el compose. La base de datos NO está en el compose.
Puertos del host: 8800 (app, `COMPOSE_PORT`), 3307 (MySQL), 8094 (wiremock), 8096 (swagger).

## Base de datos MySQL (contenedor aparte, antes de levantar el resto)
Revisa si ya existe: `docker ps -a --filter name=miflota-db` (se comparte entre proyectos). Si está detenido: `docker start miflota-db`. Si no existe: `docker run -d --name miflota-db -e MYSQL_ROOT_PASSWORD=root -p 3307:3306 mysql:5.7` y espera ~20 s. Usuario `root`, clave `root`. Schemas: `mimixer` y `mimixer-test` (créalos con `docker exec miflota-db mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS \`mimixer\`"`).

## Levantar
Archivos locales que NO vienen al clonar (.gitignore): `.env.docker.local`, `.env.compose.local` y `docker-compose-local.yml`.

```
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose-local.yml -f docker-compose-wiremock.yml up -d --build
```

`.env.docker.local`: `COMPOSE_PORT=8800` y `COMPOSE_PROJECT_NAME=mimixer`.

`docker-compose-local.yml` (monta el `~/.ssh` para Composer y define `host.docker.internal`):
```yaml
version: "3"
services:
  app:
    volumes:
      - ~/.ssh:/root/.ssh
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

`.env.compose.local` (lo lee el contenedor `app`): variables `APP_DB_HOST=host.docker.internal`, `APP_DB_PORT=3307`, `APP_DB_NAME=mimixer`, `APP_DB_USER=root`, `APP_DB_PASSWORD=root`, `APP_SECRET`, `SYMFONY_ENV=dev`, `SYMFONY_DEBUG=1`. Las URL de los demás sistemas (`APP_MISEGURIDAD_API`, `APP_MELON_MIOBRA_API`, `APP_MELON_MIFLOTA_API`, `APP_NEXUS_URL`, `APP_NEXUS_PDF_URL`, `APP_NEXUS_CONE_URL`, `APP_GPS_SERVICE_URL`, `APP_FATIGUE_USER_BLOCKER_URL`, `APP_MELON_EVALUATIONS_BASE_API`) deben apuntar a `http://host.docker.internal:8094` (wiremock). Las llaves de AWS, Nexus, GPS y Rollbar van en `null` o con valores de prueba. NUNCA pongas credenciales ni URL reales de producción.

## Preparar la base de datos
```
docker compose exec app composer install --no-scripts
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console doctrine:schema:update --force --env=test
docker compose exec app bin/console app:init-sessions
```
El repo no tiene migraciones: el esquema sale de las entidades. `app:init-sessions` crea la tabla de sesiones (sin ella toda página da `Table 'mimixer.sessions' doesn't exist`). Permisos de `var/`: `docker compose exec app chmod -R a+rwX var`.

## Probar
- Tests: `docker compose exec app vendor/bin/simple-phpunit` (phpunit-bridge; una carpeta: `… simple-phpunit tests/AppBundle/Controller`; uno: `--filter nombre`). Corren en el entorno `test` con la base `mimixer-test`.
- App en http://localhost:8800. Wiremock: `curl http://localhost:8094/__admin/mappings`.
- Nginx está DENTRO del contenedor `app`; su configuración (`docker/app/nginx.conf` y `docker/app/app.conf`) viene dentro de la imagen y se monta desde el repo en el entorno automático: `docker compose exec app nginx -t` y `docker compose exec app nginx -s reload`.
- Estado: `docker compose exec app bin/console about`.

## Ojo
- `SQLSTATE[HY000] [2002]`: MySQL apagado o `APP_DB_HOST`/`APP_DB_PORT` mal puestos. `Unknown database`: falta crear el schema.
- `config_dev.yml` apunta los clientes HTTP a `host.docker.internal:8094` y `:8009`; si wiremock corre en otro puerto esas llamadas no llegan.
- Al arrancar, el contenedor corre `cache:clear` (antes de `composer install` falla sin gravedad). Tras cambiar `.env.compose.local`: `docker compose up -d` (recrea) o `docker compose restart app`.
- Cambios en archivos de `docker/` que están dentro de la imagen exigen `docker compose up -d --build`.

## Si eres un agente
Si tu prompt trae «Entorno de pruebas», el runner ya levantó este proyecto en contenedores propios de tu ejecución (puertos, base, dependencias y esquema listos): **no ejecutes `docker compose up` ni los pasos de «Levantar» y «Preparar la base de datos»**. Usa `docker compose exec -T app …` (simple-phpunit, consola de Symfony, `nginx -t`) y `wb-curl` para probar rutas. Las pruebas usan la base `mimixer-test`, que ya existe. Si algo no queda montado en el contenedor o no hay entorno, no lo des por probado: dilo en tus dudas.
