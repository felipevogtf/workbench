FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4200

# --host 0.0.0.0: accesible desde fuera del contenedor. --poll: detecta cambios en volúmenes montados.
# El proxy (proxy.conf.js) reenvía /api al backend usando API_PROXY_TARGET.
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]
