import type {
  AttachmentRef,
  StagedAttachment,
} from '@core/attachments/attachments';
import { DomainError } from '@core/domain/domain.error';
import { Plan } from '@planner/domain/entities/plan.entity';
import {
  TaskChatRunRequest,
  TaskChatRunResult,
} from '@planner/domain/ports/agents-gateway.port';
import { CachedRepos } from '@planner/domain/ports/repos-cache.port';
import { TaskContext } from '@planner/domain/ports/tasks-gateway.port';
import { TaskChatService } from './task-chat.service';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const task: TaskContext = {
  id: 'i1',
  name: 'Tarea MEL-1',
  description: 'Hacer algo',
  projectName: 'Melón',
  stateName: null,
  priority: null,
  startDate: null,
  dueDate: null,
  estimatedHours: null,
  isLocal: false,
  members: [],
  groupId: null,
  labels: [
    { name: 'b-web', repoUrl: 'https://github.com/o/web' },
    { name: 'a-api', repoUrl: 'https://github.com/o/api' },
  ],
};

const readyPlan = (content: string) => {
  const plan = Plan.create({ issueId: 'i1' });
  plan.markGenerating();
  plan.complete({
    content,
    agentId: 'a',
    agentName: 'n',
    model: 'm',
    repos: [],
  });
  return plan;
};

function build(
  options: {
    task?: TaskContext | null;
    plans?: Plan[];
    concurrency?: number;
  } = {},
) {
  const getTask = jest
    .fn()
    .mockResolvedValue(options.task === undefined ? task : options.task);
  const findByIssueId = jest.fn().mockResolvedValue(options.plans ?? []);
  const getTicket = jest.fn((key: string) =>
    Promise.resolve(
      key === 'MEL-404'
        ? null
        : {
            key,
            title: `T ${key}`,
            stateName: null,
            labels: [],
            priority: null,
            descriptionText: null,
          },
    ),
  );
  const ensure = jest.fn<Promise<CachedRepos>, [string, string[]]>(
    (_issueId, urls) =>
      Promise.resolve({
        path: '/repos/i1',
        repos: urls.map((url) => ({
          url,
          name: url.split('/').pop() ?? '',
          used: true,
          note: null,
        })),
      }),
  );
  const runTaskChat = jest.fn<Promise<TaskChatRunResult>, [TaskChatRunRequest]>(
    () =>
      Promise.resolve({
        markdown: 'Respuesta.',
        agentName: 'default-task-chat',
        model: 'm',
      }),
  );

  const stage = jest.fn<
    Promise<ReadonlyMap<string, StagedAttachment>>,
    [readonly AttachmentRef[], string]
  >(() => Promise.resolve(new Map<string, StagedAttachment>()));

  const service = new TaskChatService(
    { getTask },
    { findByIssueId } as never,
    { getProjectIdentifiers: () => Promise.resolve(['MEL']), getTicket },
    { ensure },
    { runPlan: jest.fn(), runTaskChat },
    options.concurrency ?? 2,
    { stage },
  );
  return { service, getTicket, ensure, runTaskChat, findByIssueId, stage };
}

const ask = (content: string) => [{ role: 'user' as const, content }];

describe('TaskChatService', () => {
  it('answers with the agent inside the cached repos of the task labels', async () => {
    const { service, ensure, runTaskChat } = build();

    const reply = await service.reply('i1', ask('¿Qué falta?'));

    expect(ensure).toHaveBeenCalledWith(
      'i1',
      ['https://github.com/o/api', 'https://github.com/o/web'],
      expect.anything(),
    );
    expect(runTaskChat).toHaveBeenCalledWith({
      prompt: expect.stringContaining('¿Qué falta?') as string,
      workdir: '/repos/i1',
    });
    expect(reply).toMatchObject({
      reply: 'Respuesta.',
      agentName: 'default-task-chat',
      hasPlan: false,
    });
  });

  it('gives the agent the latest ready plan, ignoring plans that are not ready', async () => {
    const failed = Plan.create({ issueId: 'i1' });
    failed.markGenerating();
    failed.fail('boom');
    // El repositorio real entrega el más nuevo primero.
    const { service, runTaskChat } = build({
      plans: [failed, readyPlan('PLAN-NUEVO'), readyPlan('PLAN-VIEJO')],
    });

    const reply = await service.reply('i1', ask('hola'));

    const prompt = runTaskChat.mock.calls[0][0].prompt;
    expect(prompt).toContain('PLAN-NUEVO');
    expect(prompt).not.toContain('PLAN-VIEJO');
    expect(reply.hasPlan).toBe(true);
  });

  it('reads the tickets of the task and the ones the user mentions, and tells which were read', async () => {
    const { service, getTicket, runTaskChat } = build();

    const reply = await service.reply(
      'i1',
      ask('Mira también MEL-7, que es parecido'),
    );

    expect(getTicket).toHaveBeenCalledWith('MEL-7');
    expect(getTicket).toHaveBeenCalledWith('MEL-1');
    expect(reply.tickets).toEqual(['MEL-7', 'MEL-1']);
    expect(runTaskChat.mock.calls[0][0].prompt).toContain('### MEL-7: T MEL-7');
  });

  it('warns the agent about a mentioned ticket that does not exist', async () => {
    const { service, runTaskChat } = build();

    const reply = await service.reply('i1', ask('¿Y MEL-404?'));

    expect(reply.tickets).not.toContain('MEL-404');
    expect(runTaskChat.mock.calls[0][0].prompt).toContain(
      'no se pudieron leer: MEL-404',
    );
  });

  it('rejects a chat that does not end with a message of the user', async () => {
    const { service, runTaskChat } = build();

    await expect(service.reply('i1', [])).rejects.toBeInstanceOf(DomainError);
    await expect(
      service.reply('i1', [
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'hola!' },
      ]),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(service.reply('i1', ask('   '))).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(runTaskChat).not.toHaveBeenCalled();
  });

  it('fails when the task does not exist', async () => {
    const { service } = build({ task: null });

    await expect(service.reply('nope', ask('hola'))).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('answers only as many questions at a time as the limit allows', async () => {
    const { service, runTaskChat } = build({ concurrency: 1 });
    let running = 0;
    let peak = 0;
    runTaskChat.mockImplementation(async () => {
      peak = Math.max(peak, ++running);
      await sleep(5);
      running--;
      return { markdown: 'ok', agentName: 'a', model: 'm' };
    });

    await Promise.all([1, 2, 3].map(() => service.reply('i1', ask('hola'))));

    expect(peak).toBe(1);
  });
});

describe('TaskChatService with attachments', () => {
  it('leaves the attachments of the conversation next to the repos of the task and tells the agent where', async () => {
    const { service, stage, runTaskChat } = build();
    const ref = { id: 'a1', name: 'requisitos.pdf' };
    stage.mockResolvedValueOnce(
      new Map([
        [
          'a1',
          {
            id: 'a1',
            name: 'requisitos.pdf',
            path: '.attachments/a1-requisitos.pdf',
            kind: 'pdf' as const,
            size: 4096,
          },
        ],
      ]),
    );

    await service.reply('i1', [
      { role: 'user', content: 'Usa este documento', attachments: [ref] },
    ]);

    expect(stage).toHaveBeenCalledWith([ref], '/repos/i1');
    expect(runTaskChat.mock.calls[0][0].prompt).toContain(
      '`.attachments/a1-requisitos.pdf`',
    );
  });
});
