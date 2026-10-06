# workbench-app

Frontend del workbench (Angular 21, zoneless, signals). Hoy cubre **Pull requests** y **Agentes de IA**.
El plan y las decisiones están en [docs/plans/pr-review-ui.md](docs/plans/pr-review-ui.md).

## Desarrollo

```bash
npm install
npm start          # http://localhost:4200 — /api se reenvía al backend (proxy.conf.js)
npm test           # Vitest
npm run lint
npm run format
```

`API_PROXY_TARGET` cambia el destino del proxy (por defecto `http://localhost:3000`).

Con Docker (servidor + front): `docker compose up -d --build` desde `deploy/dev`.

## Estructura

```
src/app/
  core/        shell, sidebar, cliente de API, registro de módulos del menú
  shared/      kit de UI global (botones, cards, formularios, diálogos…), pipes, utilidades
  pr-review/   módulo Pull requests
  ai-agents/   módulo Agentes de IA
```

Imports con alias por módulo: `@core/*`, `@shared/*`, `@pr-review/*`, `@ai-agents/*`. Un módulo solo
importa a otro por su `index.ts` (lo hace cumplir ESLint). Para sumar un módulo nuevo: carpeta en
`src/app/`, su alias en `tsconfig.json`, sus rutas lazy y un `*.nav.ts` registrado en `app.config.ts`.

## Producción

`deploy/prod/app.Dockerfile` compila y sirve con nginx (proxy de `/api/` al servicio `server`):

```bash
docker build -f deploy/prod/app.Dockerfile -t workbench-app .   # desde la raíz del repo
```
