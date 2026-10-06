// Proxy de `ng serve`: el front llama a /api/* y el backend (sin prefijo, sin CORS) lo recibe sin /api.
// En Docker el destino es el servicio del compose (API_PROXY_TARGET=http://server:3000).
const target = process.env.API_PROXY_TARGET || 'http://localhost:3000';

module.exports = {
  '/api': {
    target,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    logLevel: 'warn',
  },
};
