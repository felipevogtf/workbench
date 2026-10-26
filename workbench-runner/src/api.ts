import type { JobResult, JobUsage, RunnerJob, UsageLimits } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Los pedidos de un trabajo largo pueden tardar: `claim` espera hasta ~25 s en el servidor. */
const CLAIM_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 20_000;

/** Lo que el runner le pide al servidor (`/runner/*`). Todo lleva el token del runner. */
export class ServerApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  hello(info: { version: string; host: string }): Promise<unknown> {
    return this.post('/runner/hello', info);
  }

  /** Responde los trabajos que debe detener y si el usuario pidió actualizar cómo va el plan. */
  async heartbeat(
    runningJobIds: string[],
  ): Promise<{ stop: string[]; probe: boolean }> {
    const response = (await this.post('/runner/heartbeat', {
      runningJobIds,
    })) as { stop?: string[]; probe?: boolean };
    return { stop: response?.stop ?? [], probe: response?.probe === true };
  }

  /** Cómo va el plan, medido por una llamada mínima. */
  async reportUsage(usage: JobUsage): Promise<void> {
    await this.post('/runner/usage', {
      limits: usage.limits satisfies UsageLimits | null,
      tokens: usage.tokens,
    });
  }

  /** Espera por trabajo; `null` si el servidor no tuvo ninguno. */
  async claim(): Promise<RunnerJob | null> {
    const response = await this.post(
      '/runner/jobs/claim',
      {},
      CLAIM_TIMEOUT_MS,
    );
    return (response as RunnerJob | undefined) ?? null;
  }

  /** `false` si el trabajo ya no es de este runner (se canceló o se dio por perdido). */
  async logs(jobId: string, text: string): Promise<boolean> {
    const response = (await this.post(`/runner/jobs/${jobId}/logs`, {
      text,
    })) as { ok?: boolean };
    return response?.ok !== false;
  }

  async finish(
    jobId: string,
    outcome:
      | {
          ok: true;
          result: JobResult;
          costUsd: number | null;
          usage?: JobUsage;
        }
      | { ok: false; error: string; costUsd: number | null; usage?: JobUsage },
  ): Promise<void> {
    await this.post(`/runner/jobs/${jobId}/result`, {
      ...outcome,
      costUsd: outcome.costUsd ?? undefined,
    });
  }

  private async post(
    path: string,
    body: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    const response = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `${path} → ${response.status} ${text.slice(0, 300)}`,
      );
    }
    return text ? (JSON.parse(text) as unknown) : undefined;
  }
}
