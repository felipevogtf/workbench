# Imagen de producción del servidor. Contexto de build: workbench-server/
#   docker build -f ../deploy/prod/server.Dockerfile -t workbench-server .

# --- Compilación ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- Runtime ---
FROM node:22-alpine
# git: clona los repos de las PRs. bash: la herramienta Bash de Claude exige una shell POSIX.
# libgcc, libstdc++ y ripgrep son requisitos del CLI de Claude en Alpine.
RUN apk add --no-cache bash git libgcc libstdc++ ripgrep \
  && npm install -g @anthropic-ai/claude-code @github/copilot
# Antigravity CLI (agy): instalador oficial, por usuario. Es opcional: si no corre en Alpine (musl),
# el build sigue y el proveedor responde que no encuentra el binario.
RUN apk add --no-cache curl \
  && (su node -c "curl -fsSL https://antigravity.google/cli/install.sh | bash" || echo "agy no se pudo instalar")
ENV PATH=/home/node/.local/bin:$PATH
# Copilot CLI en Alpine: se ejecuta con el node del sistema (ver el script).
COPY docker/copilot-node.sh /usr/local/bin/copilot-node
RUN chmod 755 /usr/local/bin/copilot-node
ENV COPILOT_BIN=/usr/local/bin/copilot-node

ENV NODE_ENV=production \
    USE_BUILTIN_RIPGREP=0 \
    SHELL=/bin/bash

WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json tsconfig.json ./

# Carpeta de las revisiones (.md); se monta como volumen.
RUN mkdir -p /data/reviews /home/node/.gemini /home/node/.copilot \
  && chown -R node:node /data/reviews /home/node

# El agente lee código ajeno: se ejecuta sin privilegios.
USER node
EXPOSE 3000

# Aplica las migraciones pendientes y arranca. Si las migraciones fallan, el contenedor no arranca.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/core/config/typeorm.datasource.js migration:run && node dist/main"]
