## Stack
Symfony + PHP 7.3 (FPM) + MySQL 5.7 + Nginx, todo en Docker. Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. Front opcional: Vue con Webpack Encore (versión antigua, Node 14/16): `yarn install` y `yarn dev` o `yarn watch`; compila a `public/build`.

## Contenedores y puertos
`app` (php-fpm), `nginx`, `supervisor` (workers de messenger), `cron`, `wiremock` (mocks de integraciones) y `swagger` (UI de wiremock). La base de datos NO está en el compose: es un contenedor aparte (`miflota-db`, mysql:5.7).
Puertos del host: 8005 (app), 3307 (MySQL), 8090 (wiremock), 8091 (swagger).

## Base de datos MySQL (contenedor aparte, antes de levantar el resto)
Revisa si ya existe: `docker ps -a --filter name=miflota-db`. Si existe pero está detenido: `docker start miflota-db`. Si no existe, créalo:
```
docker run -d --name miflota-db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=miflota \
  -p 3307:3306 \
  -v miflota-db-data:/var/lib/mysql \
  mysql:5.7
```
Espera unos 20 segundos a que MySQL termine de inicializar (`docker logs -f miflota-db`). Es la base que usa `DATABASE_URL` (usuario `root`, clave `root`, puerto 3307 del host). Si no hay base, la app falla con `SQLSTATE[HY000] [2002] Connection refused`.

## Levantar
Archivos locales que NO vienen al clonar (están en .gitignore; si faltan, Docker crea directorios en su lugar y el contenedor falla): `.env.docker.local` (`COMPOSE_PORT=8005`, `COMPOSE_PROJECT_NAME=miflota`), `.env.local` (desde `.env.local.dist`), `docker-compose-local.yml`, y desde su `.dist`: `docker/app/zdsy.conf`, `docker/supervisor/dsy.conf`, `docker/cron/crontabs/root`.

```
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose-local.yml -f docker-compose-mock.yml up -d
```
`make up` usa otros archivos: no sirve para local.

### Contenido de los archivos locales
Desde un contenedor, 127.0.0.1 es el propio contenedor: lo que corre en el host se alcanza con `host.docker.internal`. El valor por defecto de `MIMIXER_BASE_URL` en `.env` (127.0.0.1:8001) NO funciona desde el contenedor.

`.env.docker.local`:
```
COMPOSE_PORT=8005
COMPOSE_PROJECT_NAME=miflota
```

`docker-compose-local.yml` (monta el `~/.ssh` para que Composer acceda a repos privados, y define `host.docker.internal`; si `cron` o `supervisor` deben llegar al host, agrega el mismo `extra_hosts` a esos servicios):
```yaml
version: '3'
services:
  app:
    volumes:
      - ~/.ssh:/root/.ssh
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

`.env.local` (sobrescribe a `.env`; parte de `cp .env.local.dist .env.local` y completa):
```
DATABASE_URL=mysql://root:root@host.docker.internal:3307/miflota?serverVersion=5.7
COMMAND_BASE_URL=http://host.docker.internal:8090/
PREVSIS_BASE_URL=http://host.docker.internal:8090
PREVSIS_USERNAME=test
PREVSIS_PASSWORD=test
MICAMION_BASE_URL=http://host.docker.internal:8081/
MIMIXER_BASE_URL=http://host.docker.internal:8001/api/1/
MIMIXER_TOKEN=qwerty
INTEGRATION_API_KEY=change-this-integration-api-key
DSY_ADMIN_USER_PASS=
S3_KEY=
S3_SECRET=
S3_BUCKET=test.dsarhoya.cl
S3_REGION=sa-east-1
SES_KEY=
SES_SECRET=
SES_REGION=
DSY_CATCH_EMAIL_TO=tu-correo@dominio.cl
```
`DSY_ADMIN_USER_PASS` es la clave del superadmin `dsy` y debe ser el hash sha1 de la clave que quieras usar (`echo -n 'miclave' | sha1sum`); las fixtures no definen contraseñas para los demás usuarios. Las claves de AWS (S3, SES) no hacen falta para levantar: déjalas vacías salvo que pruebes S3/SES/SNS. `COMMAND_BASE_URL` y `PREVSIS_BASE_URL` van a wiremock, que sirve los stubs de `docker/wiremock/stubs/mappings/`. MiCamión y MiMixer son otras apps: solo funcionan si las tienes levantadas en el host.

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console app:ini-sessions
docker compose exec app bin/console doctrine:fixtures:load --group=base
docker compose exec app bin/console app:imp:b -f
```
El esquema sale de las entidades, no de migraciones. `app:ini-sessions` crea la tabla de sesiones: sin ella el login falla. `fixtures:load` VACÍA la base antes de cargar.

## Probar
- Tests: `docker compose exec app vendor/bin/phpunit` (un archivo: `… phpunit tests/Service/FatigueGateServiceTest.php`; un test: `--filter nombre`).
- Usan otra base, `miflota-test` (`.env.test`, el mismo MySQL). Se crea una vez: `doctrine:database:create --env=test --if-not-exists` y `doctrine:schema:update --force --env=test`.
- La app responde en http://localhost:8005. Wiremock: `curl http://localhost:8090/api/1/checklists`. Workers: `docker compose exec supervisor supervisorctl status`. Logs: `docker compose exec app tail -f var/log/dev.log`.
- Una integración nueva que necesite mock: agrega `docker/wiremock/stubs/mappings/*.json` (y su body en `__files/`) y reinicia wiremock.

## Ojo
- `doctrine:fixtures:load` borra toda la base: solo en una de desarrollo.
- Tras cambiar `.env.local`: `bin/console cache:clear` y reinicia `supervisor` (sus workers cargan el entorno al iniciar). Tras cambiar código que usan los workers: `docker compose restart supervisor`.
- `SQLSTATE[HY000] [2002] Connection refused`: MySQL apagado, o `DATABASE_URL` con 127.0.0.1 en vez de `host.docker.internal:3307`.
- Permisos de `var/`: `docker compose exec app chmod -R a+rwX var`.

## Si eres un agente
Es probable que no puedas ejecutar Docker desde tu entorno. Si no puedes correr estos comandos, no des nada por probado: dilo en tus dudas.
