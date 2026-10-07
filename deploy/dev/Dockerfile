FROM node:22-alpine

# git: clona los repos de las PRs. claude: CLI que ejecuta los agentes de revision
# (bash, libgcc, libstdc++ y ripgrep son requisitos del CLI en Alpine).
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
ENV USE_BUILTIN_RIPGREP=0
# La herramienta Bash de Claude exige una shell POSIX (bash o zsh); Alpine solo trae sh.
ENV SHELL=/bin/bash

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
