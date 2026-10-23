import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Protocolo que registra Windows: `workbench-runner://start` abre el runner. */
export const PROTOCOL = 'workbench-runner';
export const STARTUP_FILE = 'workbench-runner.vbs';
/** Archivo (junto al runner) que lanza el programa sin ventana. */
export const LAUNCHER_FILE = 'start-hidden.vbs';

export interface WindowsSetup {
  /** Carpeta del runner (donde están `dist/` y `runner.config.json`). */
  runnerDir: string;
  nodePath: string;
  /** Carpeta de «Inicio» de Windows: lo que está ahí se abre al iniciar sesión. */
  startupDir: string;
  /** Nombre del protocolo; solo cambia en las pruebas. */
  protocol?: string;
  /** Muestra lo que haría sin tocar nada. */
  dryRun?: boolean;
  log?: (message: string) => void;
}

/** Un texto como literal de VBScript (las comillas se duplican). */
export function vbsLiteral(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * El script que lanza el runner sin ventana: va a su carpeta (para encontrar `runner.config.json`) y
 * corre `node dist/main.js` con la salida en `runner.log`. Si ya hay un runner corriendo, el programa
 * mismo se da cuenta y termina, así que lanzarlo de más no hace daño.
 */
export function launcherScript(runnerDir: string, nodePath: string): string {
  const main = join(runnerDir, 'dist', 'main.js');
  const log = join(runnerDir, 'runner.log');
  const command = `cmd /c ""${nodePath}" "${main}" >> "${log}" 2>&1"`;

  return [
    "' Generado por `npm run autostart:install`: lanza el workbench-runner sin ventana.",
    'Set shell = CreateObject("WScript.Shell")',
    `shell.CurrentDirectory = ${vbsLiteral(runnerDir)}`,
    `shell.Run ${vbsLiteral(command)}, 0, False`,
    '',
  ].join('\r\n');
}

/** Lo que Windows ejecuta al abrir el enlace `workbench-runner://`. */
export function protocolCommand(launcherPath: string): string {
  return `wscript.exe //B "${launcherPath}"`;
}

/** Los comandos `reg add` que registran el protocolo para el usuario actual (no pide administrador). */
export function registryAdds(protocol: string, command: string): string[][] {
  const key = `HKCU\\Software\\Classes\\${protocol}`;
  return [
    ['add', key, '/ve', '/d', `URL:Workbench Runner`, '/f'],
    ['add', key, '/v', 'URL Protocol', '/d', '', '/f'],
    ['add', `${key}\\shell\\open\\command`, '/ve', '/d', command, '/f'],
  ];
}

function runReg(args: string[]): void {
  execFileSync('reg', args, { stdio: 'ignore' });
}

/** Deja el runner arrancando con Windows y abrible con `workbench-runner://start`. */
export function install(setup: WindowsSetup): void {
  const log = setup.log ?? console.log;
  const protocol = setup.protocol ?? PROTOCOL;
  const launcher = join(setup.runnerDir, LAUNCHER_FILE);
  const script = launcherScript(setup.runnerDir, setup.nodePath);
  const startup = join(setup.startupDir, STARTUP_FILE);
  const adds = registryAdds(protocol, protocolCommand(launcher));

  if (setup.dryRun) {
    log(`[simulación] se escribiría ${launcher}`);
    log(`[simulación] se copiaría a ${startup} (arranque con Windows)`);
    for (const args of adds)
      log(`[simulación] reg ${args.map((a) => `"${a}"`).join(' ')}`);
    return;
  }

  writeFileSync(launcher, script);
  mkdirSync(setup.startupDir, { recursive: true });
  copyFileSync(launcher, startup);
  log(`Arranque con Windows: ${startup}`);

  for (const args of adds) runReg(args);
  log(`Enlace registrado: ${protocol}://start abre el runner`);
}

/** Quita lo que dejó `install` (el archivo `start-hidden.vbs` del runner se conserva: es inofensivo). */
export function remove(setup: WindowsSetup): void {
  const log = setup.log ?? console.log;
  const protocol = setup.protocol ?? PROTOCOL;
  const startup = join(setup.startupDir, STARTUP_FILE);

  if (setup.dryRun) {
    log(`[simulación] se borraría ${startup}`);
    log(
      `[simulación] se borraría la clave HKCU\\Software\\Classes\\${protocol}`,
    );
    return;
  }

  rmSync(startup, { force: true });
  log('Arranque con Windows: quitado');
  try {
    runReg(['delete', `HKCU\\Software\\Classes\\${protocol}`, '/f']);
    log(`Enlace ${protocol}:// quitado`);
  } catch {
    log(`El enlace ${protocol}:// no estaba registrado`);
  }
}

/** La carpeta «Inicio» del usuario actual. */
export function userStartupDir(env: NodeJS.ProcessEnv = process.env): string {
  const appData = env.APPDATA;
  if (!appData) throw new Error('No se encontró la carpeta APPDATA de Windows');
  return join(
    appData,
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
  );
}
