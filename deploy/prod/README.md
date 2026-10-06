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

# 3. Atar el puerto a la IP de Tailscale del host (no se versiona)
echo "WORKBENCH_BIND=$(tailscale ip -4 | head -1)" > .env

# 4. Levantar
docker compose up -d --build
```

El sitio queda en el puerto **4321**, sin login, escuchando solo en la IP de Tailscale del host
(`WORKBENCH_BIND`). Las migraciones se aplican solas al arrancar el servidor.

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

- **No hay login**: la seguridad es la red. El puerto solo escucha en la IP de Tailscale; no lo abras a
  internet ni quites `WORKBENCH_BIND` sin poner antes autenticación y TLS delante, porque cualquiera que
  llegue podría disparar revisiones con tu cuenta de Claude y leer el código revisado.
- El servidor no publica puertos: solo el nginx lo alcanza.
- Las revisiones (.md) viven en el volumen `workbench_reviews`.
- `server.env` y `.env` están en `.gitignore`.
