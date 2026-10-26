/**
 * `wb-curl`: el único `curl` que usa el agente. Solo habla con este PC (`localhost`), no escribe archivos
 * fuera de `/dev/null` y no admite opciones que cambien a dónde o cómo se conecta.
 */

/** Opciones largas que se rechazan: cambian el destino, leen configuración o suben/escriben archivos. */
const FORBIDDEN_LONG = [
  '--config',
  '--next',
  '--proxy',
  '--preproxy',
  '--socks',
  '--unix-socket',
  '--abstract-unix-socket',
  '--connect-to',
  '--resolve',
  '--output-dir',
  '--remote-name',
  '--remote-name-all',
  '--remote-header-name',
  '--netrc',
  '--upload-file',
  '--trace',
  '--stderr',
  '--libcurl',
  '--ftp',
  '--hsts',
  '--alt-svc',
];

/** Opciones cortas que se rechazan (también dentro de un grupo como `-sx`). */
const FORBIDDEN_SHORT = 'xKOTJ:';

/** Opciones que escriben un archivo: solo se admite `/dev/null` (o `-`, la salida estándar). */
const WRITES_FILE_LONG = ['--output', '--dump-header', '--cookie-jar'];
const WRITES_FILE_SHORT = 'oDc';

const SINK = new Set(['/dev/null', '-', 'NUL']);

/** Lo que se antepone a lo que pida el agente: sin `.curlrc`, todo conecta a este PC y sin proxy. */
export const CURL_FIXED_ARGS = [
  '-q',
  '--connect-to',
  '::127.0.0.1:',
  '--noproxy',
  '*',
  '--max-time',
  '60',
];

/** Devuelve por qué se rechaza la llamada, o `null` si se puede hacer. */
export function checkCurlArgs(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') continue;

    if (arg.startsWith('--')) {
      const name = arg.split('=')[0];
      if (FORBIDDEN_LONG.some((forbidden) => name.startsWith(forbidden))) {
        return `la opción ${name} no está permitida`;
      }
      if (WRITES_FILE_LONG.includes(name)) {
        const value = arg.includes('=')
          ? arg.slice(name.length + 1)
          : args[++i];
        if (!SINK.has(value ?? '')) {
          return `${name} solo puede escribir en /dev/null`;
        }
      }
      continue;
    }

    if (/^-[A-Za-z0-9:]+$/.test(arg) && arg.length > 1) {
      const letters = arg.slice(1);
      const bad = [...letters].find((letter) =>
        FORBIDDEN_SHORT.includes(letter),
      );
      if (bad) return `la opción -${bad} no está permitida`;
      const writer = [...letters].find((letter) =>
        WRITES_FILE_SHORT.includes(letter),
      );
      if (writer) {
        // El valor es lo que sigue en el mismo grupo o, si no hay más letras, el próximo argumento.
        const rest = letters.slice(letters.indexOf(writer) + 1);
        const value = rest || args[++i];
        if (!SINK.has(value ?? '')) {
          return `-${writer} solo puede escribir en /dev/null`;
        }
      }
    }
  }
  return null;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const problem = checkCurlArgs(args);
  if (problem) {
    console.error(`wb-curl: ${problem}. Solo se permite hablar con localhost.`);
    process.exit(2);
  }
  // Se carga aquí, no arriba: las pruebas solo necesitan la validación.
  const { spawnSync } =
    require('node:child_process') as typeof import('node:child_process');
  const result = spawnSync('curl', [...CURL_FIXED_ARGS, ...args], {
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}
