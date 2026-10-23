import { runClaude } from './claude';
import { effectiveTools, type RunnerConfig } from './config';
import { git } from './git';
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
    return {
      result: { baseBranch: workspace.baseBranch, headAfter },
      costUsd: null,
    };
  }

  const agent = payload.agent;
  if (!agent)
    throw new Error('El servidor no mandó un agente para este trabajo');

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
    tools,
    prompt: payload.prompt,
    cwd: workspace.dir,
    timeoutMs: context.config.timeoutMinutes[job.kind] * 60_000,
    maxBudgetUsd: context.config.maxBudgetUsd,
    onLog: context.onLog,
    signal: context.signal,
  });
  const output = claude.output.slice(0, MAX_OUTPUT_CHARS);

  if (job.kind !== 'develop') {
    return { result: { output }, costUsd: claude.costUsd };
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

  return { result: { output, headBefore, headAfter }, costUsd: claude.costUsd };
}
