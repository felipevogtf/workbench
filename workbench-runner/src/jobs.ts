import { probeUsage, runClaude } from './claude';
import { effectiveTools, type RunnerConfig } from './config';
import { environmentTools, type Environments } from './environment';
import { git } from './git';
import {
  discardSubmoduleChanges,
  submoduleNotice,
  submodulePaths,
} from './submodules';
import type { JobAgent, JobOutcome, RunnerJob } from './types';
import type { Workspaces } from './workspace';

/**
 * Quién firma el commit: el agente que hizo el trabajo y «(IA)» al final, para que en la PR se vea que no lo escribió una
 * persona. Solo cambia el nombre; el correo sigue siendo el que tenga configurado git en este equipo. Sin agente, git usa
 * la identidad de siempre.
 */
export function commitIdentity(
  agent: Pick<JobAgent, 'name' | 'displayName'> | null | undefined,
): Record<string, string> {
  const base = (agent?.displayName?.trim() || agent?.name || '')
    .replace(/[<>\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return {};
  const name = /\(IA\)$/i.test(base) ? base : `${base} (IA)`;
  return { GIT_AUTHOR_NAME: name, GIT_COMMITTER_NAME: name };
}

/** Tope de la respuesta del agente que viaja al servidor (el cuerpo de una petición es limitado). */
const MAX_OUTPUT_CHARS = 60_000;

export interface JobContext {
  config: RunnerConfig;
  workspaces: Workspaces;
  /** Si está, los proyectos con entorno configurado se levantan en contenedores para desarrollar y revisar. */
  environments?: Environments;
  onLog: (line: string) => void;
  signal: AbortSignal;
}

/** Hace un trabajo de la ejecución, en el worktree de su rama. */
export async function runJob(
  job: RunnerJob,
  context: JobContext,
): Promise<JobOutcome> {
  const { payload } = job;
  context.onLog(
    `▶ ${job.kind} (intento ${job.attempt}) en ${payload.repo.fullName}, rama ${payload.branch}`,
  );

  // Una pregunta del chat sobre una ejecución que ya terminó vuelve a armar la carpeta de trabajo y su entorno: lo que ella
  // creó se retira al terminar, para no dejar contenedores ni carpetas que nadie más va a usar.
  const hadWorkspace =
    job.kind !== 'chat' ||
    (await context.workspaces.has(payload.repo, payload.branch));
  const workspace = await context.workspaces.prepare(
    payload.repo,
    payload.branch,
  );

  if (job.kind === 'publish') {
    context.onLog('Subiendo la rama…');
    await context.workspaces.push(workspace.dir, payload.branch);
    const headAfter = (
      await git(['rev-parse', 'HEAD'], { cwd: workspace.dir })
    ).trim();
    // Lo que crearon los contenedores se devuelve al runner antes de borrar el worktree, y con él se baja el entorno.
    await context.environments?.reclaim(job.executionId, workspace.dir);
    await context.workspaces.release(payload.repo, payload.branch);
    await context.environments?.tearDown(job.executionId, context.onLog);
    context.onLog(
      `Rama subida (${headAfter.slice(0, 8)}), PR hacia ${workspace.baseBranch}`,
    );
    // Lo último de una ejecución: una medida del plan para saber cuánto costó entera.
    const usage = await probeUsage({
      bin: context.config.claudeBin,
      binArgs: context.config.claudeBinArgs,
    });
    return {
      result: { baseBranch: workspace.baseBranch, headAfter },
      costUsd: null,
      ...(usage ? { usage } : {}),
    };
  }

  const agent = payload.agent;
  if (!agent)
    throw new Error('El servidor no mandó un agente para este trabajo');

  // Los otros repos de la tarea quedan a la vista del agente, solo para leer: cada uno en su propio
  // worktree, con lo que ya se hizo en su rama.
  const consult: { fullName: string; dir: string; branch: string }[] = [];
  const createdByChat: { fullName: string; branch: string }[] = [];
  for (const other of payload.context ?? []) {
    if (
      job.kind === 'chat' &&
      !(await context.workspaces.has(other, other.branch))
    ) {
      createdByChat.push({ fullName: other.fullName, branch: other.branch });
    }
    const prepared = await context.workspaces.prepare(other, other.branch);
    consult.push({
      fullName: other.fullName,
      dir: prepared.dir,
      branch: other.branch,
    });
  }
  // Los submódulos son de otros repos: se empieza sin cambios en ellos (por si un intento anterior los dejó) y el
  // agente sabe que no debe tocarlos.
  const submodules = await submodulePaths(workspace.dir);
  const leftovers = await discardSubmoduleChanges(workspace.dir, submodules);
  if (leftovers.length > 0) {
    context.onLog(
      `Se descartaron cambios que habían quedado en los submódulos: ${leftovers.join(', ')}`,
    );
  }
  // El entorno de pruebas del proyecto, si tiene uno configurado. También lo usa Lucy al crear los tickets (así verifica el
  // plan contra el código instalado antes de que el usuario dé el visto bueno) y el desarrollador lo reutiliza después.
  let environment = await context.environments?.ensure({
    executionId: job.executionId,
    repo: payload.repo,
    dir: workspace.dir,
    onLog: context.onLog,
    signal: context.signal,
  });
  // Lucy mira todos los repos de la tarea, no solo el de su ticket: los que tienen entorno se levantan también, para que
  // tengan sus dependencias instaladas. `docker compose` apunta a uno solo: el del repo principal o, si ese no tiene
  // entorno, el primero de los otros que lo tenga.
  const alsoUp: string[] = [];
  if (job.kind === 'chat' || job.kind === 'tickets') {
    for (const other of consult) {
      const handle = await context.environments?.ensure({
        executionId: job.executionId,
        repo: { fullName: other.fullName },
        dir: other.dir,
        onLog: context.onLog,
        signal: context.signal,
      });
      if (!handle?.processEnv.COMPOSE_PROJECT_NAME) continue;
      if (environment?.processEnv.COMPOSE_PROJECT_NAME) {
        alsoUp.push(other.fullName);
      } else {
        environment = handle;
      }
    }
  }
  const prompt =
    payload.prompt.replace(
      /\{\{dir:([^}]+)\}\}/g,
      (placeholder, name: string) =>
        consult.find((other) => other.fullName === name)?.dir ?? placeholder,
    ) +
    submoduleNotice(submodules, job.kind) +
    (environment?.notice ?? '') +
    (alsoUp.length > 0
      ? `

También se levantaron los entornos de ${alsoUp.join(', ')}, solo para que sus dependencias estén instaladas y se puedan leer: \`docker compose\` y \`wb-curl\` apuntan al entorno de arriba.`
      : '');

  const headBefore = (
    await git(['rev-parse', 'HEAD'], { cwd: workspace.dir })
  ).trim();
  const tools = [
    ...effectiveTools(
      agent.allowedTools,
      context.config.allowedTools[job.kind],
    ),
    // Con el entorno arriba, el agente puede usar sus contenedores (y solo ellos): lo decide el runner, no el servidor.
    ...(environment?.processEnv.COMPOSE_PROJECT_NAME
      ? environmentTools(job.kind)
      : []),
  ];
  const dropped = agent.allowedTools.filter((tool) => !tools.includes(tool));
  if (dropped.length > 0) {
    context.onLog(
      `Herramientas que este runner no permite y se quitaron: ${dropped.join(', ')}`,
    );
  }

  let claude: Awaited<ReturnType<typeof runClaude>>;
  try {
    claude = await runClaude({
      bin: context.config.claudeBin,
      binArgs: context.config.claudeBinArgs,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      effort: agent.effort,
      tools,
      addDirs: consult.map((other) => other.dir),
      prompt,
      cwd: workspace.dir,
      env: environment?.processEnv,
      timeoutMs: context.config.timeoutMinutes[job.kind] * 60_000,
      maxBudgetUsd: context.config.maxBudgetUsd,
      onLog: context.onLog,
      signal: context.signal,
    });
  } finally {
    // Los contenedores dejan archivos a nombre de root: se devuelven al runner antes de tocar el worktree con git.
    await context.environments?.reclaim(job.executionId, workspace.dir);
    for (const other of consult) {
      await context.environments?.reclaim(job.executionId, other.dir);
    }
    // La revisión final es lo último de su ejecución: no hay más trabajos que usen el entorno. Una pregunta del chat baja el
    // que ella misma tuvo que armar (la ejecución ya había terminado y sus carpetas estaban retiradas).
    const rebuilt = !hadWorkspace || createdByChat.length > 0;
    if (job.kind === 'final' || (job.kind === 'chat' && rebuilt))
      await context.environments?.tearDown(job.executionId, context.onLog);
  }
  const output = claude.output.slice(0, MAX_OUTPUT_CHARS);

  // Los repos de consulta no se tocan: si el agente cambió algo ahí, se descarta.
  for (const other of consult) {
    const changed = (
      await git(['status', '--porcelain'], { cwd: other.dir })
    ).trim();
    if (changed) {
      context.onLog(
        `El agente cambió archivos de ${other.fullName}, que es solo de consulta: se descartan.`,
      );
      await git(['reset', '--hard', 'HEAD'], { cwd: other.dir });
      await git(['clean', '-fd'], { cwd: other.dir });
    }
  }

  if (
    job.kind === 'review' ||
    job.kind === 'final' ||
    job.kind === 'chat' ||
    job.kind === 'tickets'
  ) {
    // El revisor corre pruebas, lint y build, que pueden dejar archivos (un `lint --fix`, por ejemplo): no es su trabajo
    // cambiar nada, y lo que quede se colaría en el commit del próximo desarrollo.
    await discardSubmoduleChanges(workspace.dir, submodules);
    const left = (
      await git(['status', '--porcelain'], { cwd: workspace.dir })
    ).trim();
    if (left) {
      context.onLog(
        'El revisor dejó archivos cambiados al correr los comandos: se descartan.',
      );
      await git(['reset', '--hard', 'HEAD'], { cwd: workspace.dir });
      await git(['clean', '-fd'], { cwd: workspace.dir });
    }
  }

  if (job.kind === 'chat') {
    if (!hadWorkspace) {
      await context.workspaces.release(payload.repo, payload.branch);
    }
    for (const created of createdByChat) {
      await context.workspaces.release(created, created.branch);
    }
  }

  if (job.kind !== 'develop') {
    return { result: { output }, costUsd: claude.costUsd, usage: claude.usage };
  }

  // Lo que el agente haya cambiado dentro de un submódulo no es de este repo: se descarta, y el commit lleva solo
  // lo que sí lo es (si no, git se queja de «contenido modificado» que no puede agregar).
  const touched = await discardSubmoduleChanges(workspace.dir, submodules);
  if (touched.length > 0) {
    context.onLog(
      `El agente cambió submódulos (${touched.join(', ')}), que son de otros repositorios: se descartan.`,
    );
  }

  // El agente no hace commit: lo hace el runner con lo que quedó en el worktree.
  const changes = (
    await git(['status', '--porcelain'], { cwd: workspace.dir })
  ).trim();
  if (changes) {
    const files = changes.split('\n').length;
    context.onLog(`Guardando ${files} archivo(s) modificados…`);
    await git(['add', '--all'], { cwd: workspace.dir });
    await git(
      [
        'commit',
        '--no-verify',
        '-m',
        payload.commitMessage ||
          `Trabajo de la ejecución ${job.executionId.slice(0, 8)}`,
      ],
      { cwd: workspace.dir, env: commitIdentity(payload.agent) },
    );
  } else {
    context.onLog('El agente no dejó cambios en los archivos.');
  }
  const headAfter = (
    await git(['rev-parse', 'HEAD'], { cwd: workspace.dir })
  ).trim();

  return {
    result: { output, headBefore, headAfter },
    costUsd: claude.costUsd,
    usage: claude.usage,
  };
}
