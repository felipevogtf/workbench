## Stack
Symfony 5 + PHP 7.4 (imagen `dsarhoya/sercom:2`, Debian 11) + PostgreSQL 13 con PostGIS. Es el backend de Sercom (API `/api/1/…` para la app Android y el panel web). Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. La consola es `bin/console`.

## Contenedores y puertos
`app` (php-fpm + nginx, desde `docker/app/Dockerfile.prod`, puerto 8000 → `COMPOSE_PORT`). `supervisor` y `cron` existen en el compose pero NO se levantan para probar (el compose de `cron` apunta a un `Dockerfile.cron` que no existe). La base de datos NO está en el compose: es un PostgreSQL con PostGIS aparte (`postgis/postgis:13-3.3`, usuario `postgres`, clave `root`).

## Archivos locales que no vienen al clonar
`docker-compose-local.yml`, `docker/app/zdsy.conf` (copia de `zdsy.conf.dist`), `.env.local` y `.env.test.local` (solo `DATABASE_URL`) y `.env.docker.local` (`COMPOSE_PORT`, `COMPOSE_PROJECT_NAME`). La app lee la base de `DATABASE_URL` con host `host.docker.internal`.

Levantar a mano: `COMPOSE_PROJECT_NAME=sercom COMPOSE_PORT=8002 docker compose -f docker-compose.yml -f docker-compose-local.yml up -d --build app`.

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console doctrine:schema:update --force --env=test
```
Las bases se crean desde la plantilla `template_postgis` (`CREATE DATABASE … TEMPLATE template_postgis`); sin PostGIS el esquema falla. El esquema de pruebas va en otra base (la del `.env.test.local`).

## Probar
- Lint: `docker compose exec -T app php -l ruta/Archivo.php`.
- Tests: `docker compose exec -T app vendor/bin/phpunit` (una clase: `… phpunit tests/Controller/Api/TaskControllerTest.php`; uno: `--filter nombre`). Usan `FixtureAwareTestCase` (cargan sus propias fixtures).
- App: `wb-curl http://localhost:<puerto>/`. Nginx está dentro de `app`: `docker compose exec app nginx -t`.

## Ojo
- La imagen base es Debian 11 y su repo de seguridad ya no está en `security.debian.org`: construir `docker/app/Dockerfile.prod` tal cual falla con 404 al instalar nginx. El runner usa un `Dockerfile.wb` propio (mismo contenido + `sed` hacia `archive.debian.org`). Si lo ves fallar a mano, es eso.
- `SOFTLAND_DATABASE_URL` (SQL Server) solo se usa en comandos de importación; no hace falta para las pruebas.
- Las pruebas de la API dependen de `config/packages/dsy_authenticator.yml` (códigos de error 1000-1003).

## Si eres un agente
Si tu prompt trae «Entorno de pruebas», el runner ya levantó este proyecto en contenedores propios de tu ejecución (base, esquema y dependencias listos): **no ejecutes `docker compose up` ni los pasos de «Preparar la base de datos»**. Usa `docker compose exec -T app …` (`php -l`, `vendor/bin/phpunit`, `bin/console`) y `wb-curl`. Si no hay entorno, no des nada por probado: dilo en tus dudas.
