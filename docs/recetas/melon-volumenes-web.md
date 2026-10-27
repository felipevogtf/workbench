## Stack
Symfony 5.4 + PHP 8.1 (FPM, alpine, imagen propia desde `docker/app/Dockerfile`) + MySQL/MariaDB + Nginx, todo en Docker. Es el backend de Volúmenes (API + admin). Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. La consola es `bin/console`; el front controller es `public/index.php`. La configuración va en variables de entorno de Symfony (`.env` versionado + `.env.local` / `.env.test.local`, que NO vienen al clonar).

## Contenedores y puertos
`app` (php-fpm) y `nginx`. No hay base de datos, wiremock ni workers en el compose. Los reportes se escriben en `public/reports`.
Puertos del host: 8801 (app, `COMPOSE_PORT`), 3307 (MySQL).

## Base de datos MySQL (contenedor aparte, antes de levantar el resto)
Revisa si ya existe: `docker ps -a --filter name=miflota-db` (se comparte entre proyectos). Si está detenido: `docker start miflota-db`. Si no existe: `docker run -d --name miflota-db -e MYSQL_ROOT_PASSWORD=root -p 3307:3306 mysql:5.7` y espera ~20 s. Usuario `root`, clave `root`. Schemas: `volumenes` y `volumenes_test` (en test Doctrine agrega el sufijo `_test` al nombre).

## Levantar
Archivos locales que NO vienen al clonar (.gitignore): `.env.docker.local`, `docker-compose-local.yml`, `.env.local` y `.env.test.local`.

```
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose-local.yml up -d --build
```

`.env.docker.local`: `COMPOSE_PORT=8801` y `COMPOSE_PROJECT_NAME=appvol`.

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

`.env.local` (sobrescribe a `.env`; desde el contenedor lo del host se alcanza con `host.docker.internal`):
```
APP_ENV=dev
APP_SECRET=ThisTokenIsNotSoSecretChangeIt
DATABASE_URL="mysql://root:root@host.docker.internal:3307/volumenes?serverVersion=5.7&charset=utf8mb4"
JWT_SECRET_KEY=ThisTokenIsNotSoSecretChangeIt
MIMIXER_API_BASE_URL=http://host.docker.internal:1
CMD_WS_BASE_URL=http://host.docker.internal:1
AI_PROVIDER=mock
```
`.env.test.local`: `APP_ENV=test`, el mismo `DATABASE_URL` y `JWT_SECRET_KEY` (en el entorno `test` Symfony NO lee `.env.local`). Si `MIMIXER_API_BASE_URL` o `CMD_WS_BASE_URL` quedan vacías, toda página da `Invalid "base_uri" option`. Deja vacías las llaves de AWS, Google, SBIF y de IA; la IA va en modo `mock`. NUNCA pongas credenciales ni URL reales de producción (el `.env` trae `mimixertest.dsy.cl`: no lo uses).

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console doctrine:schema:update --force --env=test
```
La carpeta `migrations/` está vacía: el esquema sale de las entidades. Si el schema no existe, créalo (`docker exec miflota-db mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS volumenes"`; igual `volumenes_test`). Permisos: `docker compose exec app chmod -R a+rwX var public/reports`.

## Probar
- Tests: `docker compose exec app vendor/bin/phpunit` (una carpeta: `… phpunit tests/Controller`; uno: `--filter nombre`). Corren con `APP_ENV=test` y la base `volumenes_test`.
- App en http://localhost:8801 (`/login` y `/` responden 200; `bin/console about` muestra el entorno).
- Nginx: configuración del sitio en `docker/nginx/dsy.conf`, montada en el contenedor: `docker compose exec nginx nginx -t` y `docker compose exec nginx nginx -s reload`.
- Rutas: `docker compose exec app bin/console debug:router`.

## Ojo
- `SQLSTATE[HY000] [2002]`: MySQL apagado o `DATABASE_URL` sin `host.docker.internal:3307`. `Unknown database`: falta crear el schema.
- `Symfony Runtime is missing` al correr `bin/console` antes de `composer install`: es normal, falta instalar dependencias.
- Tras cambiar `.env.local`: `docker compose exec app bin/console cache:clear`.
- La imagen del `app` se construye localmente: un cambio en `docker/app/` exige `docker compose up -d --build`.

## Si eres un agente
Si tu prompt trae «Entorno de pruebas», el runner ya levantó este proyecto en contenedores propios de tu ejecución (puertos, base, dependencias y esquema listos): **no ejecutes `docker compose up` ni los pasos de «Levantar» y «Preparar la base de datos»**. Usa `docker compose exec -T app …` (phpunit, consola de Symfony), `docker compose exec -T nginx nginx -t` y `wb-curl` para probar rutas. Las pruebas usan la base `volumenes_test`, que ya existe. Si algo no queda montado en el contenedor o no hay entorno, no lo des por probado: dilo en tus dudas.
