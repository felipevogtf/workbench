#!/usr/bin/env node
// Un `codegraph` de mentira para las pruebas: anota con qué argumentos lo llamaron.
const fs = require('node:fs');
if (process.env.FAKE_CODEGRAPH_LOG) {
  fs.appendFileSync(
    process.env.FAKE_CODEGRAPH_LOG,
    `${process.argv.slice(2).join(' ')} | ${process.env.CODEGRAPH_TELEMETRY}\n`,
  );
}
