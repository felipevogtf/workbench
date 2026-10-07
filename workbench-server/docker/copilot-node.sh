#!/bin/sh
# Ejecuta Copilot CLI con el node del sistema.
#
# En Alpine (musl) el lanzador `copilot` arranca un runtime nativo que falla con
# "Node-API symbol ... has not been loaded". El mismo paquete que descarga el lanzador
# (~/.cache/copilot/pkg) sí funciona ejecutado con `node`, así que se llama directo.
set -e

find_entry() {
  ls -d "$HOME"/.cache/copilot/pkg/*/*/ 2>/dev/null | tail -n 1
}

entry="$(find_entry)"
if [ -z "$entry" ]; then
  # Primera ejecución: el lanzador descarga el paquete (aunque luego falle al arrancar).
  copilot --version >/dev/null 2>&1 || true
  entry="$(find_entry)"
fi

if [ -z "$entry" ]; then
  echo "Copilot CLI no se pudo descargar" >&2
  exit 127
fi

exec node "${entry}index.js" "$@"
