import {
  CreatedRunner,
  Execution,
  ExecutionDetail,
  ExecutionStatus,
  ExecutionTicket,
  JobSummary,
  Runner,
} from '../models/execution';

export function ticket(id: string, extra: Partial<ExecutionTicket> = {}): ExecutionTicket {
  return {
    id,
    title: `Ticket ${id}`,
    description: 'Hacer algo',
    criteria: [],
    status: 'pending',
    rounds: 0,
    feedback: null,
    summary: null,
    reviewNote: null,
    ...extra,
  };
}

export function execution(
  id: string,
  status: ExecutionStatus = 'running',
  extra: Partial<Execution> = {},
): Execution {
  return {
    id,
    issueId: 'i1',
    repo: {
      url: 'https://bitbucket.org/acme/web',
      host: 'bitbucket.org',
      fullName: 'acme/web',
      sshUrl: 'git@bitbucket.org:acme/web.git',
    },
    branch: `workbench/tarea-${id}`,
    baseBranch: null,
    status,
    stages: [
      { key: 'tickets', status: 'running', startedAt: null, finishedAt: null },
      { key: 'develop', status: 'pending', startedAt: null, finishedAt: null },
      { key: 'review', status: 'pending', startedAt: null, finishedAt: null },
      { key: 'publish', status: 'pending', startedAt: null, finishedAt: null },
    ],
    tickets: [],
    pullRequestUrl: null,
    error: null,
    createdAt: '2026-10-23T12:00:00Z',
    updatedAt: '2026-10-23T12:00:00Z',
    finishedAt: null,
    ...extra,
  };
}

export function job(id: string, extra: Partial<JobSummary> = {}): JobSummary {
  return {
    id,
    kind: 'tickets',
    ticketId: null,
    status: 'done',
    attempt: 1,
    costUsd: 0.25,
    error: null,
    runnerId: 'r1',
    startedAt: '2026-10-23T12:00:00Z',
    finishedAt: '2026-10-23T12:01:00Z',
    ...extra,
  };
}

export function detail(
  id: string,
  status: ExecutionStatus = 'running',
  extra: Partial<ExecutionDetail> = {},
): ExecutionDetail {
  return {
    ...execution(id, status),
    jobs: [job('j1')],
    waitingForRunner: false,
    costUsd: 0.25,
    ...extra,
  };
}

export function runner(id: string, extra: Partial<Runner> = {}): Runner {
  return {
    id,
    name: `PC ${id}`,
    version: '0.1.0',
    host: 'DESKTOP-1',
    lastSeenAt: '2026-10-23T12:00:00Z',
    online: true,
    isDefault: false,
    createdAt: '2026-10-20T12:00:00Z',
    ...extra,
  };
}

export function createdRunner(id: string): CreatedRunner {
  return { ...runner(id, { lastSeenAt: null, online: false }), token: 'wbr_secreto' };
}
