FROM node:22-alpine

# git: clona los repos de las PRs. claude: CLI que ejecuta los agentes de revision
# (bash, libgcc, libstdc++ y ripgrep son requisitos del CLI en Alpine).
RUN apk add --no-cache bash git libgcc libstdc++ ripgrep \
  && npm install -g @anthropic-ai/claude-code
ENV USE_BUILTIN_RIPGREP=0
# La herramienta Bash de Claude exige una shell POSIX (bash o zsh); Alpine solo trae sh.
ENV SHELL=/bin/bash

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
