## Stack
Symfony 3.4 + PHP 7.1 (FPM, imagen `dsarhoya/dsy-fpm-71-mariadb-ep:2`) + MySQL + Nginx, todo en Docker. Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. La consola es `bin/console` y hay un solo front controller, `web/app.php`; el entorno lo fija `SYMFONY_ENV` (sin ella corre `prod`). Este proyecto es Symfony 3: la configuración va en `app/config/parameters.yml`, NO en `.env.local`.

## Contenedores y puertos
`app` (php-fpm + cron), `nginx`, `pdftk` (servicio web que une/rellena PDF) y, con el compose de mocks, `wiremock` y `swagger`. La base de datos NO está en el compose.
Puertos del host: 8003 (app, `COMPOSE_PORT`), 3307 (MySQL), 8096 (wiremock), 8097 (swagger).

## Base de datos MySQL (contenedor aparte, antes de levantar el resto)
Revisa si ya existe: `docker ps -a --filter name=miflota-db` (se comparte entre proyectos). Si está detenido: `docker start miflota-db`. Si no existe: `docker run -d --name miflota-db -e MYSQL_ROOT_PASSWORD=root -p 3307:3306 mysql:5.7` y espera ~20 s. Usuario `root`, clave `root`. Schemas: `miplanta` y `miplanta-test`.

## Levantar
Archivos locales que NO vienen al clonar (.gitignore): `.env.docker.local`, `docker-compose-local.yml` y `app/config/parameters.yml`.

```
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose-local.yml -f docker-compose-wiremock.yml up -d --build
```

`.env.docker.local`: `COMPOSE_PORT=8003` y `COMPOSE_PROJECT_NAME=miplanta`.

`docker-compose-local.yml` (monta el `~/.ssh` para Composer, define `host.docker.internal` y fija el entorno):
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

`app/config/parameters.yml`: parte de `parameters.yml.dist` (`composer install` lo crea si falta) y ajusta:
```
database_host: host.docker.internal
database_port: 3307
database_name: miplanta
database_user: root
database_password: root
nexus_melon_base_url: 'http://host.docker.internal:8096/'
```
Deja en `~` las llaves de AWS (S3, SES, SNS, transcoder) y Rollbar. NUNCA pongas URL o credenciales reales de producción (`servicio-oic.melon.cl`, `nexus.melon.cl`): ojo, `app/config/config.yml` también fija `nexus_melon_base_url` a producción y pisa al `parameters.yml`; para probar contra wiremock hay que cambiarlo ahí, sin commitearlo.

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console doctrine:schema:update --force --env=test
docker compose exec app bin/console app:init-sessions
```
El repo no tiene migraciones: el esquema sale de las entidades. `app:init-sessions` crea la tabla de sesiones (sin ella toda página da error 500). Permisos de `var/`: `docker compose exec app chmod -R a+rwX var`.

## Probar
- Tests: `docker compose exec app vendor/bin/simple-phpunit` (phpunit-bridge; una carpeta: `… simple-phpunit tests/AppBundle`; uno: `--filter nombre`). Corren en el entorno `test` con la base `miplanta-test`.
- App en http://localhost:8003. Wiremock: `curl http://localhost:8096/__admin/mappings`.
- Nginx: configuración del sitio en `docker/nginx/dsy-prod.conf`, montada en el contenedor: `docker compose exec nginx nginx -t` y `docker compose exec nginx nginx -s reload`.
- Estado: `docker compose exec app bin/console about`.

## Ojo
- `SQLSTATE[HY000] [2002]`: MySQL apagado o `database_host`/`database_port` mal puestos. `Unknown database`: falta crear el schema.
- `config_dev.yml` apunta un cliente HTTP a `host.docker.internal:8004`; wiremock corre en 8096.
- Tras cambiar `parameters.yml`: `docker compose exec app bin/console cache:clear` (y `--env=test`).
- Los archivos de `docker/php` y `docker/nginx` se montan desde el repo: un cambio ahí exige reiniciar el contenedor (`docker compose restart app` / `nginx`).

## Si eres un agente
Si tu prompt trae «Entorno de pruebas», el runner ya levantó este proyecto en contenedores propios de tu ejecución (puertos, base, dependencias y esquema listos): **no ejecutes `docker compose up` ni los pasos de «Levantar» y «Preparar la base de datos»**. Usa `docker compose exec -T app …` (simple-phpunit, consola de Symfony), `docker compose exec -T nginx nginx -t` y `wb-curl` para probar rutas. Las pruebas usan la base `miplanta-test`, que ya existe. Si algo no queda montado en el contenedor o no hay entorno, no lo des por probado: dilo en tus dudas.
