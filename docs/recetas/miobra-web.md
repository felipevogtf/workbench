## Stack
Symfony 3.4 + PHP 7.1 (FPM, imagen `dsarhoya/dsy-fpm-71-mariadb-ep:2`) + MySQL + Nginx, todo en Docker. Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. La consola es `bin/console` y el front ya viene compilado en `web/build` (no hace falta `yarn`). Un solo front controller: `web/app.php`; el entorno lo fija la variable `SYMFONY_ENV` (sin ella corre `prod`).

## Contenedores y puertos
`app` (php-fpm + cron), `nginx` y, con el compose de mocks, `wiremock` y `swagger`. Los nombres de contenedor llevan `${COMPOSE_PROJECT_NAME}.` delante. No hay `supervisor` ni base de datos en el compose: la base es un MySQL aparte.
Puertos del host: 8008 (app, `COMPOSE_PORT`), 3307 (MySQL), 8096 (wiremock), 8097 (swagger).

## Base de datos MySQL (contenedor aparte, antes de levantar el resto)
Revisa si ya existe: `docker ps -a --filter name=miflota-db` (se comparte con MiFlota y MiSeguridad). Si está detenido: `docker start miflota-db`. Si no existe: `docker run -d --name miflota-db -e MYSQL_ROOT_PASSWORD=root -p 3307:3306 mysql:5.7` y espera ~20 s. Usuario `root`, clave `root`, puerto 3307. Schemas: `miobra` y `miobra-test`.

## Levantar
Archivos locales que NO vienen al clonar (.gitignore): `.env.docker.local`, `docker-compose-local.yml` y `app/config/parameters.yml` (este proyecto es Symfony 3: usa `parameters.yml`, NO `.env.local`).

```
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose-local.yml -f docker-compose-wiremock.yml up -d
```

`.env.docker.local`: `COMPOSE_PORT=8008` y `COMPOSE_PROJECT_NAME=miobra`.

`docker-compose-local.yml` (monta el `~/.ssh` para Composer, define `host.docker.internal` y fija el entorno de Symfony):
```yaml
version: '3'
services:
  app:
    environment:
      - SYMFONY_ENV=dev
      - SYMFONY_DEBUG=1
    volumes:
      - ~/.ssh:/root/.ssh
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

`app/config/parameters.yml`: parte de `parameters.yml.dist` (`composer install` lo crea si falta) y ajusta lo del host, que se alcanza con `host.docker.internal`:
```
database_host: host.docker.internal
database_port: 3307
database_name: miobra
database_user: root
database_password: root
mimixer_api_base_url: 'http://host.docker.internal:8096/'
miseguridad_api_base_url: 'http://host.docker.internal:8096/'
mi_pedido_url: 'http://host.docker.internal:8096/'
gps_service_url: 'http://host.docker.internal:8096/'
router.request_context.host: localhost
router.request_context.scheme: http
```
Deja en `~` las llaves de AWS (S3, SES, SNS), Rollbar y las de servicios externos. NUNCA pongas las URL reales (`servicio-oic.melon.cl`, `nexus.melon.cl`, `miseguridad.dsy.cl`, `mimixer.dsy.cl`): son producción.

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console doctrine:schema:update --force --env=test
docker compose exec app bin/console app:init-sessions
```
El repo no tiene migraciones: el esquema sale de las entidades. `app:init-sessions` crea la tabla de sesiones (sin ella toda página da error 500). Si el schema no existe, créalo (`docker exec miflota-db mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS miobra"`; igual `miobra-test`). Permisos de `var/`: `docker compose exec app chmod -R a+rwX var`.

## Probar
- Tests: `docker compose exec app vendor/bin/simple-phpunit` (phpunit-bridge; una carpeta: `… simple-phpunit tests/Controller`; uno: `--filter nombre`). Corren en el entorno `test`, con la base `miobra-test` (`config_test.yml`).
- App en http://localhost:8008. Wiremock: `curl http://localhost:8096/__admin/mappings`. Los mocks están en `docker/wiremock/stubs`.
- Nginx: la configuración del sitio es `docker/nginx/dsy-prod.conf`, montada en el contenedor: se valida con `docker compose exec nginx nginx -t` y se aplica con `docker compose exec nginx nginx -s reload`.
- Estado de Symfony: `docker compose exec app bin/console about`.

## Ojo
- `SQLSTATE[HY000] [2002]`: MySQL apagado o `database_host`/`database_port` mal puestos. `Unknown database`: falta crear el schema.
- `config_dev.yml` apunta los clientes HTTP (MiPedido, comandos, GPS) a `host.docker.internal:8096`; si wiremock corre en otro puerto esas llamadas no llegan y la app falla al usarlas. `config_prod.yml` apunta a servicios reales: nunca corras la app en `prod` contra ellos.
- Tras cambiar `parameters.yml` o la configuración: `docker compose exec app bin/console cache:clear` (y `--env=test`).
- Varios archivos de `docker/` (php, nginx) se montan desde el repo: un cambio ahí exige reiniciar el contenedor correspondiente (`docker compose restart app`).

## Si eres un agente
Si tu prompt trae «Entorno de pruebas», el runner ya levantó este proyecto en contenedores propios de tu ejecución (puertos, base, dependencias y esquema listos): **no ejecutes `docker compose up` ni los pasos de «Levantar» y «Preparar la base de datos»**. Usa `docker compose exec -T app …` (simple-phpunit, consola de Symfony), `docker compose exec -T nginx nginx -t` y `wb-curl` para probar rutas. Las pruebas usan la base `miobra-test`, que ya existe. Si algo no queda montado en el contenedor o no hay entorno, no lo des por probado: dilo en tus dudas.
