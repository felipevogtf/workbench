## Stack
Symfony 4.4 + PHP (imagen `dsarhoya/tienda-melon:6`) + Doctrine ORM 2.19 + Messenger + Webpack Encore, con MySQL/MariaDB y Nginx, todo en Docker. Es la tienda de Melón: catálogo, precios por localidad, pedidos y pagos (Webpay). Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host.

## Contenedores y puertos
`app` (construido desde `docker/php`: supervisord con php-fpm, cron y el worker `messenger-consume`), `nginx` (desde `docker/nginx`, es el que publica el puerto) y `rotate` (logrotate). No hay wiremock ni mocks.
Puertos del host: 8021 (app, `COMPOSE_PORT`) y 3307 (MySQL).
La base de datos NO está en el compose: es un MySQL en `host.docker.internal:3307` (el mismo contenedor compartido entre proyectos); en producción es MariaDB 10.2.

## Levantar
Archivos locales que NO vienen al clonar (los ignora `.gitignore`): `.env.docker.local`, `.env.local`, `.env.test.local`, `docker-compose-local.yml` y, dentro de `docker/`, `nginx/dsy.conf`, `php/dsy.conf`, `php/zdsy.conf` y `php/dsycron`. Los de `docker/` se crean copiando sus `.dist`:

```
cp docker/nginx/dsy.conf.dist docker/nginx/dsy.conf
cp docker/php/dsy.conf.dist docker/php/dsy.conf
cp docker/php/zdsy.conf.dist docker/php/zdsy.conf
cp docker/php/dsycron.dist docker/php/dsycron
```

```
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose-local.yml up -d --build
```
NO agregues `docker-compose-test.yml`: es para stage/QA y conecta a una red externa `dsy` que no existe en local. La primera vez usa `--build`.

`.env.docker.local`: `COMPOSE_PORT=8021` y `COMPOSE_PROJECT_NAME=melontienda`. El nombre del proyecto importa: `docker/nginx/dsy.conf` apunta a `fastcgi_pass melontienda.app:9000`, y el contenedor de PHP se llama `${COMPOSE_PROJECT_NAME}.app`. Con otro nombre el nginx responde 502 hasta que cambies esa línea.

`docker-compose-local.yml` (monta el `~/.ssh` para Composer y define `host.docker.internal`):
```yaml
version: "3"
services:
  app:
    volumes:
      - /root/.ssh:/root/.ssh
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

`.env.local` (sobrescribe `DATABASE_URL` de `.env`, que trae `serverVersion=mariadb-10.2.6`; dentro del contenedor 127.0.0.1 es el propio contenedor, lo del host se alcanza con `host.docker.internal`):
```
DATABASE_URL=mysql://root:root@host.docker.internal:3307/melontienda
```
`DATABASE_TIENDA1_URL` (una segunda conexión a la base antigua `melon_tienda`, `127.0.0.1:3305`) no hace falta para levantar.

Los assets: en desarrollo Encore busca `public/build-dev/entrypoints.json`, que no se versiona (`.gitignore`). Compílalo con `yarn install && yarn dev` en el host o, solo para ver el sitio, copia la compilación de producción que sí viene en el repo: `cp -a public/build public/build-dev`. Sin eso toda página da 500 («Could not find the entrypoints file from Webpack»).

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:database:create --if-not-exists
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console messenger:setup-transports
docker compose exec app chmod -R a+rwX var
```
El repo trae 125 migraciones (`migrations/`) pero el esquema también sale de las entidades: para una base vacía basta `doctrine:schema:update --force`. `messenger:setup-transports` crea la tabla `messenger_messages`; sin ella el worker `messenger-consume` falla en bucle y llena `var/log/dev.log`. La base queda vacía: para datos de prueba hay un dump viejo, `mysql -u root -p melontienda < ./SQL/dump_test_20200128.sql`.

## Probar
- Tests: `docker compose exec app vendor/bin/phpunit` (PHPUnit 9; una carpeta o archivo: `… phpunit tests/Controller`; uno: `--filter nombre`). Corren con `APP_ENV=test` y la base `melontienda-test`: en `.env.test.local` pon `DATABASE_URL=mysql://root:root@host.docker.internal:3307/melontienda-test` y créala una vez con `doctrine:database:create --env=test --if-not-exists` y `doctrine:schema:update --force --env=test`. Hay también `vendor/bin/simple-phpunit` (phpunit-bridge).
- App en http://localhost:8021. Salud: `docker compose exec app bin/console about`. Workers: `docker compose exec app supervisorctl status`.

## Ojo
- 500 con «Could not find the entrypoints file from Webpack»: falta `public/build-dev` (ver «Levantar»).
- 502 desde nginx: `COMPOSE_PROJECT_NAME` distinto de `melontienda` o `docker/nginx/dsy.conf` con otro nombre de contenedor.
- `SQLSTATE[HY000] [2002]`: MySQL apagado o `DATABASE_URL` sin `host.docker.internal:3307`. `Unknown database 'melontienda'`: falta `doctrine:database:create`.
- El worker `messenger-consume` reiniciándose cada segundo en `docker compose logs app`: falta la tabla de Messenger (`messenger:setup-transports`) o la base.
- Tras cambiar `.env.local`: `bin/console cache:clear` y `docker compose restart app`. Cambios en archivos de `docker/php` o `docker/nginx` exigen `docker compose up -d --build`.
- El cron de la imagen corre tareas periódicas; si molesta en local, `docker compose exec app supervisorctl stop cron`.

## Si eres un agente
Si tu prompt trae «Entorno de pruebas», el runner ya levantó este proyecto en contenedores propios de tu ejecución (puertos, base, dependencias, esquema y assets listos, y con el `dsy.conf` de nginx apuntando al contenedor de esta ejecución): **no ejecutes `docker compose up` ni los pasos de «Levantar» y «Preparar la base de datos»**. Usa `docker compose exec -T app …` (phpunit, consola de Symfony) y `wb-curl` para probar rutas. Las pruebas usan la base `melontienda-test`, que ya existe. La base empieza vacía: una página que necesite datos (productos, precios) puede responder vacía o con error sin que sea un fallo tuyo. Si algo no queda montado en el contenedor o no hay entorno, no lo des por probado: dilo en tus dudas.
