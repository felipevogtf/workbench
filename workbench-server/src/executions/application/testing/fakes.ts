import { Execution } from '@executions/domain/entities/execution.entity';
import { Job } from '@executions/domain/entities/job.entity';
import { Runner } from '@executions/domain/entities/runner.entity';
import type { ExecutionRepositoryPort } from '@executions/domain/ports/execution-repository.port';
import type {
  AgentsGatewayPort,
  ExecutionAgentModule,
  ExecutionTask,
  NewPullRequest,
  PlansGatewayPort,
  PullRequestsGatewayPort,
  ReadableRepo,
  ReadyPlan,
  RepositoriesGatewayPort,
  ResolvedAgent,
  TasksGatewayPort,
} from '@executions/domain/ports/gateways.port';
import type { JobRepositoryPort } from '@executions/domain/ports/job-repository.port';
import type { RunnerRepositoryPort } from '@executions/domain/ports/runner-repository.port';
import type { UsageSnapshotRepositoryPort } from '@executions/domain/ports/usage-snapshot-repository.port';
import type { UsageSnapshot } from '@executions/domain/usage';

export class InMemoryExecutions implements ExecutionRepositoryPort {
  readonly items = new Map<string, Execution>();

  findById(id: string): Promise<Execution | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }
  findByIssueId(issueId: string): Promise<Execution[]> {
    return Promise.resolve(
      [...this.items.values()].filter((item) => item.issueId === issueId),
    );
  }
  findRecent(limit: number): Promise<Execution[]> {
    return Promise.resolve(
      [...this.items.values()]
        .reverse()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit),
    );
  }
  findActiveByIssueId(issueId: string): Promise<Execution | null> {
    return Promise.resolve(
      [...this.items.values()].find(
        (item) => item.issueId === issueId && item.isActive,
      ) ?? null,
    );
  }
  save(execution: Execution): Promise<Execution> {
    this.items.set(execution.id, execution);
    return Promise.resolve(execution);
  }
}

export class InMemoryJobs implements JobRepositoryPort {
  readonly items: Job[] = [];

  findById(id: string): Promise<Job | null> {
    return Promise.resolve(this.items.find((job) => job.id === id) ?? null);
  }
  findByExecutionId(executionId: string): Promise<Job[]> {
    return Promise.resolve(
      this.items.filter((job) => job.executionId === executionId),
    );
  }
  findRunning(): Promise<Job[]> {
    return Promise.resolve(
      this.items.filter((job) => job.status === 'running'),
    );
  }
  findFinishedSince(since: Date): Promise<Job[]> {
    return Promise.resolve(
      this.items.filter(
        (job) => (job.finishedAt?.getTime() ?? 0) >= since.getTime(),
      ),
    );
  }
  save(job: Job): Promise<Job> {
    if (!this.items.includes(job)) this.items.push(job);
    return Promise.resolve(job);
  }
  claimNext(runnerId: string): Promise<Job | null> {
    const job = this.items.find((candidate) => candidate.status === 'pending');
    if (!job) return Promise.resolve(null);

    const props = job.toProps();
    props.status = 'running';
    props.runnerId = runnerId;
    props.startedAt = new Date();
    return Promise.resolve(job);
  }
}

export class InMemoryRunners implements RunnerRepositoryPort {
  readonly items = new Map<string, Runner>();

  findById(id: string): Promise<Runner | null> {
    return Promise.resolve(this.items.get(id) ?? null);
  }
  findByTokenHash(tokenHash: string): Promise<Runner | null> {
    return Promise.resolve(
      [...this.items.values()].find((r) => r.tokenHash === tokenHash) ?? null,
    );
  }
  findAll(): Promise<Runner[]> {
    return Promise.resolve([...this.items.values()]);
  }
  save(runner: Runner): Promise<Runner> {
    this.items.set(runner.id, runner);
    return Promise.resolve(runner);
  }
  markSeen(
    id: string,
    info: { version?: string; host?: string } = {},
  ): Promise<boolean> {
    // Como la base: solo actualiza lo que existe.
    const runner = this.items.get(id);
    if (!runner) return Promise.resolve(false);
    runner.introduce(info);
    return Promise.resolve(true);
  }
  makeDefault(id: string): Promise<void> {
    for (const runner of this.items.values()) {
      runner.toProps().isDefault = runner.id === id;
    }
    return Promise.resolve();
  }
  delete(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }
}

export class FakeTasks implements TasksGatewayPort {
  task: ExecutionTask | null = {
    id: 'issue-1',
    name: 'Vista de órdenes de carga',
    description: 'Mostrar las órdenes',
    repoUrls: ['https://bitbucket.org/acme/web'],
    key: null,
    members: [],
    groupId: null,
  };
  getTask(): Promise<ExecutionTask | null> {
    return Promise.resolve(this.task);
  }
}

export class FakePlans implements PlansGatewayPort {
  plan: ReadyPlan | null = { id: 'plan-1', content: '## Pasos\n1. Hacer todo' };
  getLatestReadyPlan(): Promise<ReadyPlan | null> {
    return Promise.resolve(this.plan);
  }
  getPlan(): Promise<ReadyPlan | null> {
    return Promise.resolve(this.plan);
  }
}

export class FakeAgents implements AgentsGatewayPort {
  provider = 'claude';
  tools = ['Read'];
  /** Agentes extra por módulo, además del por defecto. */
  extra: ResolvedAgent[] = [];
  /** Los prompts con que se conversó con Lucy. */
  readonly chats: string[] = [];
  chatReply = 'Respuesta de Lucy';

  /** La carpeta de código con que se conversó en cada pregunta (`undefined` = una vacía). */
  readonly chatWorkdirs: (string | undefined)[] = [];

  chat(request: { prompt: string; workdir?: string }) {
    this.chats.push(request.prompt);
    this.chatWorkdirs.push(request.workdir);
    return Promise.resolve({
      reply: this.chatReply,
      agentName: 'default-task-tickets',
      model: 'claude-sonnet-5-5',
    });
  }

  private base(module: ExecutionAgentModule): ResolvedAgent {
    return {
      id: `agent-${module}`,
      name: `default-${module}`,
      displayName: null,
      provider: this.provider,
      model: 'claude-sonnet-5-5',
      systemPrompt: `prompt de ${module}`,
      allowedTools: [...this.tools],
      effort: null,
      level: null,
      isDefault: true,
    };
  }

  getDefault(module: ExecutionAgentModule): Promise<ResolvedAgent> {
    return Promise.resolve(this.base(module));
  }

  listByModule(module: ExecutionAgentModule): Promise<ResolvedAgent[]> {
    const extra = this.extra.filter((agent) => agent.id.includes(module));
    return Promise.resolve([this.base(module), ...extra]);
  }

  getById(id: string): Promise<ResolvedAgent | null> {
    const modules: ExecutionAgentModule[] = [
      'task-tickets',
      'task-developer',
      'task-reviewer',
    ];
    const all = [...modules.map((module) => this.base(module)), ...this.extra];
    return Promise.resolve(all.find((agent) => agent.id === id) ?? null);
  }
}

export class FakeRepositories implements RepositoriesGatewayPort {
  /** Lo que devuelve; `null` = no hay forma de leer el código. */
  result: { path: string; repos: ReadableRepo[] } | null = null;
  readonly asked: string[] = [];

  ensure(issueId: string) {
    this.asked.push(issueId);
    return Promise.resolve(this.result);
  }
}

export class FakePullRequests implements PullRequestsGatewayPort {
  readonly created: NewPullRequest[] = [];
  failWith: string | null = null;
  create(request: NewPullRequest): Promise<{ url: string }> {
    if (this.failWith) return Promise.reject(new Error(this.failWith));
    this.created.push(request);
    return Promise.resolve({ url: 'https://bitbucket.org/acme/web/pull/7' });
  }
}

export class InMemoryUsageSnapshots implements UsageSnapshotRepositoryPort {
  readonly items: UsageSnapshot[] = [];

  save(snapshot: UsageSnapshot): Promise<UsageSnapshot> {
    this.items.push(snapshot);
    return Promise.resolve(snapshot);
  }
  findLatest(): Promise<UsageSnapshot | null> {
    const sorted = [...this.items].sort(
      (a, b) => b.takenAt.getTime() - a.takenAt.getTime(),
    );
    return Promise.resolve(sorted[0] ?? null);
  }
  findFirstAtOrAfter(date: Date): Promise<UsageSnapshot | null> {
    const later = this.items
      .filter((item) => item.takenAt.getTime() >= date.getTime())
      .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
    return Promise.resolve(later[0] ?? null);
  }
}
