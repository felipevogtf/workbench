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
  ReadyPlan,
  ResolvedAgent,
  TasksGatewayPort,
} from '@executions/domain/ports/gateways.port';
import type { JobRepositoryPort } from '@executions/domain/ports/job-repository.port';
import type { RunnerRepositoryPort } from '@executions/domain/ports/runner-repository.port';

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
  getDefault(module: ExecutionAgentModule): Promise<ResolvedAgent> {
    return Promise.resolve({
      name: `default-${module}`,
      provider: this.provider,
      model: 'claude-sonnet-5-5',
      systemPrompt: `prompt de ${module}`,
      allowedTools: ['Read'],
    });
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
