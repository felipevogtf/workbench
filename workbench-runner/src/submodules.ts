import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './git';
import type { JobKind } from './types';

/**
 * Los submódulos de un repo son otros repositorios metidos en una carpeta. Lo que el agente cambie ahí no
 * viaja en la rama ni en la PR del repo principal (git solo ve «contenido modificado»), así que hacer el
 * commit falla o publica un puntero movido. Por eso el runner no los deja tocar: descarta esos cambios.
 */

/** Las rutas de los submódulos del repo; vacío si no tiene. */
export async function submodulePaths(dir: string): Promise<string[]> {
  if (!existsSync(join(dir, '.gitmodules'))) return [];

  const listed = await git(
    [
      'config',
      '--file',
      '.gitmodules',
      '--get-regexp',
      '^submodule\\..*\\.path$',
    ],
    { cwd: dir },
  ).catch(() => '');
  return listed
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).slice(1).join(' '))
    .filter(Boolean);
}

/**
 * Deja cada submódulo como lo registra el repo principal: en el commit registrado, sin archivos
 * modificados ni nuevos. Devuelve los que tenían algo que descartar.
 */
export async function discardSubmoduleChanges(
  dir: string,
  paths: readonly string[],
): Promise<string[]> {
  const touched: string[] = [];
  for (const path of paths) {
    // Visto desde el repo principal, un submódulo con cambios, commits nuevos o archivos sin seguir sale modificado.
    const dirty = (
      await git(['status', '--porcelain', '--', path], { cwd: dir }).catch(
        () => '',
      )
    ).trim();
    if (!dirty) continue;

    touched.push(path);
    await git(
      ['submodule', 'update', '--init', '--force', '--recursive', '--', path],
      {
        cwd: dir,
      },
    );
    // `update --force` restaura lo seguido; los archivos nuevos hay que borrarlos aparte.
    await git(['clean', '-fd'], { cwd: join(dir, path) }).catch(
      () => undefined,
    );
  }
  return touched;
}

/** Lo que se le dice al agente de un trabajo sobre las carpetas que son submódulos; vacío si no hay. */
export function submoduleNotice(
  paths: readonly string[],
  kind: JobKind,
): string {
  if (paths.length === 0 || kind === 'publish') return '';

  const list = paths.map((path) => `- ${path}`).join('\n');
  const rule =
    kind === 'tickets'
      ? 'No crees tickets que las modifiquen: si el plan lo pide, déjalo fuera y dilo en la descripción del ticket que más se acerque.'
      : kind === 'develop'
        ? 'Puedes leerlas, pero NO las modifiques: todo cambio ahí se descarta. Si lo que pide el ticket está ahí, no lo hagas: dilo en tu resumen y haz lo que sí está en este repositorio. Si no queda nada fuera de ellas, no hagas cambios y termina con una línea `PREGUNTA: …`.'
        : 'Los cambios dentro de ellas se descartan y no forman parte del ticket: no los pidas ni los des por hechos; juzga el ticket solo por lo que cambió en este repositorio.';

  return [
    '',
    '',
    '# Submódulos de este repositorio',
    'Estas carpetas son submódulos: otros repositorios que NO se publican con este.',
    list,
    rule,
  ].join('\n');
}
