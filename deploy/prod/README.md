# Despliegue en producción

Servidor (NestJS) + front (Angular servido por nginx) en contenedores. La base de datos es el Postgres
que ya corre en el host (`~/git_repos/docker-compose.db.yml`); este compose se conecta a su red.

## Primera vez

```bash
cd deploy/prod

# 1. Base de datos: rol y base `workbench` en el Postgres existente
#    (ver "Crear la base de datos" más abajo)

# 2. Variables del servidor (no se versiona)
cp server.env.example server.env && chmod 600 server.env
#    completar: DATABASE_URL, PLANE_*, CLAUDE_CODE_OAUTH_TOKEN, BITBUCKET_*/GITHUB_TOKEN

# 3. Usuario y contraseña de acceso al sitio (no se versiona)
mkdir -p secrets
printf 'usuario:%s\n' "$(openssl passwd -apr1 'LA-CONTRASEÑA')" > secrets/htpasswd

# 4. Levantar
docker compose up -d --build
```

El sitio queda en el puerto **4321** del host, protegido con usuario y contraseña. Las migraciones se
aplican solas al arrancar el servidor.

## Actualizar

```bash
git pull
cd deploy/prod && docker compose up -d --build
```

## Crear la base de datos

```bash
docker exec git_repos-postgres-1 sh -c 'psql -U "$POSTGRES_USER" -d postgres \
  -c "CREATE ROLE workbench LOGIN PASSWORD '"'"'LA-CLAVE'"'"'" \
  -c "CREATE DATABASE workbench OWNER workbench"'
```

## Notas de seguridad

- El sitio va por **HTTP**: el usuario y la contraseña viajan sin cifrar. Para uso fuera de una red
  de confianza, ponle TLS delante (un proxy con certificado) o accede por túnel SSH
  (`ssh -L 4321:localhost:4321 personal_server`).
- El servidor no publica puertos: solo el nginx lo alcanza.
- Las revisiones (.md) viven en el volumen `workbench_reviews`.
- `server.env` y `secrets/` están en `.gitignore`.
