## Stack
Symfony + PHP 7.3 (FPM, imagen `dsy-fpm-73-mariadb`) + MySQL 5.7 + Nginx, todo en Docker. Los comandos de PHP, Composer y Symfony se ejecutan DENTRO del contenedor `app` (`docker compose exec app …`), nunca en el host. No hay que compilar el front (`public/angular/dist` ya viene en el repo) ni correr `app:ini-sessions` (las sesiones van a archivo).

## Contenedores y puertos
`app` (php-fpm), `nginx`, `supervisor` (workers de messenger), `cron`, y con el compose de mocks `wiremock` y `swagger`.
Puertos del host: 8019 (app), 3307 (MySQL), 8096 (wiremock), 8097 (swagger).
La base de datos NO está en el compose: es un único MySQL 5.7 compartido entre proyectos (el mismo contenedor de MiFlota, puerto 3307); cada proyecto agrega su propio schema (`miseguridad`, `miseguridad-test`) con `doctrine:database:create`.

## Levantar
Archivos locales que NO vienen al clonar (.gitignore): `.env.docker.local`, `.env.local`, `docker-compose-local.yml`, `config/jwt/private.pem` y `public.pem`, y `client_secret.json` (credenciales de Google, las da el equipo: no se pueden generar).

```
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose-local.yml -f docker-compose-wiremock.yml up -d --build
```
NO agregues `docker-compose-test.yml`: conecta a una red externa `dsy` que no existe en local. La primera vez usa `--build`.

`.env.docker.local`: `COMPOSE_PORT=8019` y `COMPOSE_PROJECT_NAME=miseguridad`.

`docker-compose-local.yml` (monta el `~/.ssh` para Composer y define `host.docker.internal`):
```yaml
version: '3'
services:
  app:
    volumes:
      - ~/.ssh:/root/.ssh
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

`.env.local` (sobrescribe a `.env`; dentro del contenedor 127.0.0.1 es el propio contenedor, lo del host se alcanza con `host.docker.internal`):
```
DATABASE_URL=mysql://root:root@host.docker.internal:3307/miseguridad?serverVersion=5.7
MIMIXER_BASE_URL=http://host.docker.internal:8096/api/1/
MIMIXER_TOKEN=qwerty
DSY_ADMIN_USER_PASS=
JWT_PASSPHRASE=cambia-esta-frase
S3_KEY=
S3_SECRET=
S3_BUCKET=test.dsarhoya.cl
S3_REGION=sa-east-1
```
`MIMIXER_BASE_URL` debe terminar en `/api/1/`: los stubs de wiremock (`docker/wiremock/stubs/mappings/`) cuelgan de ahí y simulan MiMixer. AWS no hace falta para levantar.

Llaves JWT (misma frase que `JWT_PASSPHRASE`):
```
mkdir -p config/jwt
openssl genpkey -out config/jwt/private.pem -aes256 -algorithm rsa -pkeyopt rsa_keygen_bits:4096
openssl pkey -in config/jwt/private.pem -out config/jwt/public.pem -pubout
```

## Preparar la base de datos
```
docker compose exec app composer install
docker compose exec app bin/console doctrine:database:create --if-not-exists
docker compose exec app bin/console doctrine:schema:update --force
docker compose exec app bin/console app:import:entities
docker compose restart supervisor
```
El repo no tiene migraciones: el esquema sale de las entidades. `AppFixtures` está vacío: los datos de prueba salen de los imports contra wiremock. Opcional: `app:import:construction-sites --batch-size=100 --force`. Reinicia `supervisor` después de crear el esquema (al arrancar corre `messenger:setup-transports`).

## Probar
- Tests: `docker compose exec app vendor/bin/phpunit` (una carpeta o archivo: `… phpunit tests/Controller/Api`; uno: `--filter nombre`). Usan la base `miseguridad-test`; `.env.test` apunta al puerto 8888, así que en `.env.test.local` pon `DATABASE_URL=mysql://root:root@host.docker.internal:3307/miseguridad-test?serverVersion=5.7`. Se crea una vez: `doctrine:database:create --env=test --if-not-exists` y `doctrine:schema:update --force --env=test`.
- App en http://localhost:8019. Wiremock: `curl http://localhost:8096/api/1/branchoffices`. Workers: `docker compose exec supervisor supervisorctl status`. Salud: `bin/console about` y `bin/console ping`.
- Login superadmin `dsy`: `DSY_ADMIN_USER_PASS` debe ser el hash sha1 de la clave (`echo -n 'clave' | sha1sum`). La API usa JWT.

## Ojo
- `SQLSTATE[HY000] [2002]`: MySQL apagado, o `DATABASE_URL` sin `host.docker.internal:3307`. `Unknown database 'miseguridad'`: falta `doctrine:database:create`.
- Login JWT con 500: falta una llave de `config/jwt/` o la frase no coincide con `JWT_PASSPHRASE`.
- Tras cambiar `.env.local` o la configuración: `bin/console cache:clear` y `docker compose restart supervisor`. Permisos de `var/`: `docker compose exec app chmod -R a+rwX var`.
- El cron en local corre imports cada hora; si no se quiere, `docker compose stop cron`.

## Si eres un agente
Es probable que no puedas ejecutar Docker desde tu entorno. Si no puedes correr estos comandos, no des nada por probado: dilo en tus dudas.
