# Build con el contexto en la raíz del repo:
#   docker build -f deploy/prod/app.Dockerfile -t workbench-app .

# --- Compilación ---
FROM node:22-alpine AS build
WORKDIR /app
COPY workbench-app/package*.json ./
RUN npm ci
COPY workbench-app/ .
RUN npm run build -- --configuration production

# --- Servidor estático + proxy a la API ---
FROM nginx:1.27-alpine
COPY deploy/prod/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/workbench-app/browser /usr/share/nginx/html
EXPOSE 80
