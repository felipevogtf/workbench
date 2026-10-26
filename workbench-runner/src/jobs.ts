import { probeUsage, runClaude } from './claude';
import { effectiveTools, type RunnerConfig } from './config';
import { git } from './git';
import {
  discardSubmoduleChanges,
  submoduleNotice,
  submodulePaths,
} from './submodules';
import type { JobOutcome, RunnerJob } from './types';
import type { Workspaces } from './workspace';

/** Tope de la respuesta del agente que viaja al servidor (el cuerpo de una petición es limitado). */
const MAX_OUTPUT_CHARS = 60_000;

export interface JobContext {
  config: RunnerConfig;
  workspaces: Workspaces;
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
    await context.workspaces.release(payload.repo, payload.branch);
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
  const consult: { fullName: string; dir: string }[] = [];
  for (const other of payload.context ?? []) {
    const prepared = await context.workspaces.prepare(other, other.branch);
    consult.push({ fullName: other.fullName, dir: prepared.dir });
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
  const prompt =
    payload.prompt.replace(
      /\{\{dir:([^}]+)\}\}/g,
      (placeholder, name: string) =>
        consult.find((other) => other.fullName === name)?.dir ?? placeholder,
    ) + submoduleNotice(submodules, job.kind);

  const headBefore = (
    await git(['rev-parse', 'HEAD'], { cwd: workspace.dir })
  ).trim();
  const tools = effectiveTools(
    agent.allowedTools,
    context.config.allowedTools[job.kind],
  );
  const dropped = agent.allowedTools.filter((tool) => !tools.includes(tool));
  if (dropped.length > 0) {
    context.onLog(
      `Herramientas que este runner no permite y se quitaron: ${dropped.join(', ')}`,
    );
  }

  const claude = await runClaude({
    bin: context.config.claudeBin,
    binArgs: context.config.claudeBinArgs,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    effort: agent.effort,
    tools,
    addDirs: consult.map((other) => other.dir),
    prompt,
    cwd: workspace.dir,
    timeoutMs: context.config.timeoutMinutes[job.kind] * 60_000,
    maxBudgetUsd: context.config.maxBudgetUsd,
    onLog: context.onLog,
    signal: context.signal,
  });
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

  if (job.kind === 'review') {
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
      {
        cwd: workspace.dir,
      },
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
