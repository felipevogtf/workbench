import { Execution } from '@executions/domain/entities/execution.entity';
import { ExecutionTicket } from '@executions/domain/entities/execution.props';
import { ExecutionChatService } from './execution-chat.service';
import {
  FakeAgents,
  FakePlans,
  FakeRepositories,
  FakeTasks,
  InMemoryExecutions,
  InMemoryJobs,
} from './testing/fakes';

const REPO = {
  url: 'https://bitbucket.org/acme/web',
  host: 'bitbucket.org',
  fullName: 'acme/web',
  sshUrl: 'git@bitbucket.org:acme/web.git',
};

function ticket(
  id: string,
  extra: Partial<ExecutionTicket> = {},
): ExecutionTicket {
  return {
    id,
    title: `Ticket ${id}`,
    description: 'Hacer algo',
    criteria: [],
    level: 'medium',
    developerId: null,
    reviewerId: null,
    status: 'pending',
    rounds: 0,
    feedback: null,
    startSha: null,
    headSha: null,
    summary: null,
    reviewNote: null,
    ...extra,
  };
}

describe('ExecutionChatService', () => {
  let executions: InMemoryExecutions;
  let agents: FakeAgents;
  let plans: FakePlans;
  let repositories: FakeRepositories;
  let service: ExecutionChatService;
  let execution: Execution;

  beforeEach(async () => {
    executions = new InMemoryExecutions();
    agents = new FakeAgents();
    plans = new FakePlans();
    repositories = new FakeRepositories();
    service = new ExecutionChatService(
      executions,
      new InMemoryJobs(),
      new FakeTasks(),
      plans,
      agents,
      repositories,
    );

    execution = Execution.create({
      issueId: 'issue-1',
      planId: 'plan-1',
      repo: REPO,
      branch: 'workbench/vista-1234abcd',
    });
    execution.setTickets([
      ticket('a', {
        title: 'API de órdenes',
        status: 'failed',
        developerId: 'agent-task-developer-simple',
        feedback: ['Maneja el error 404'],
        summary: 'Agregué el endpoint',
        reviewNote: 'Falta el caso vacío',
      }),
      ticket('b', { title: 'Pantalla' }),
    ]);
    execution.fail('El revisor sigue pidiendo cambios');
    await executions.save(execution);

    agents.extra = [
      {
        id: 'agent-task-developer-simple',
        name: 'task-developer-simple',
        displayName: 'Rebecca',
        provider: 'claude',
        model: 'm',
        systemPrompt: 'x',
        allowedTools: [],
        effort: null,
        level: 'simple',
        isDefault: false,
      },
    ];
  });

  const ask = (text: string) =>
    service.reply(execution.id, [{ role: 'user', content: text }]);

  it('gives Lucy the whole state of the execution and returns her answer', async () => {
    agents.chatReply = 'Falló porque el revisor pidió cambios.';

    const answer = await ask('¿Por qué falló?');

    expect(answer.reply).toBe('Falló porque el revisor pidió cambios.');
    const prompt = agents.chats[0];
    expect(prompt).toContain('Vista de órdenes de carga'); // la tarea
    expect(prompt).toContain('falló'); // el estado
    expect(prompt).toContain('El revisor sigue pidiendo cambios'); // el error
    expect(prompt).toContain('API de órdenes'); // los tickets
    expect(prompt).toContain('desarrolla: Rebecca'); // por su nombre, no el técnico
    expect(prompt).toContain('Maneja el error 404'); // lo que pidió el revisor
    expect(prompt).toContain('Agregué el endpoint'); // lo que dijo el desarrollador
    expect(prompt).toContain('## Pasos'); // el plan
    expect(prompt).toContain('¿Por qué falló?'); // la pregunta
  });

  it('knows who she is and that she can only talk', async () => {
    await ask('Hola');

    const prompt = agents.chats[0];
    expect(prompt).toContain('Eres default-task-tickets');
    expect(prompt).toContain('No puedes cambiar la ejecución desde aquí');
  });

  it('keeps the earlier turns of the conversation, with who said each one', async () => {
    await service.reply(execution.id, [
      { role: 'user', content: 'Primera pregunta' },
      { role: 'assistant', content: 'Primera respuesta' },
      { role: 'user', content: 'Segunda pregunta' },
    ]);

    const prompt = agents.chats[0];
    expect(prompt).toContain('Primera pregunta');
    expect(prompt).toContain('Primera respuesta');
    expect(prompt.indexOf('Primera pregunta')).toBeLessThan(
      prompt.indexOf('Segunda pregunta'),
    );
  });

  it('refuses a conversation whose last message is not the user’s', async () => {
    await expect(
      service.reply(execution.id, [
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: 'Hola, ¿qué necesitas?' },
      ]),
    ).rejects.toThrow('user’s');
    expect(agents.chats).toHaveLength(0);
  });

  it('fails with not found when the execution does not exist', async () => {
    await expect(
      service.reply('no-existe', [{ role: 'user', content: 'Hola' }]),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('does not make up the plan when it no longer exists', async () => {
    plans.plan = null;

    await ask('¿Qué decía el plan?');

    expect(agents.chats[0]).toContain('el plan ya no existe');
  });

  describe('reading the code', () => {
    const cloned = (used = true) => ({
      path: '/cache/issue-1',
      repos: [
        {
          url: 'https://bitbucket.org/acme/web',
          folder: 'acme-web',
          used,
          note: used ? null : 'no se pudo clonar',
        },
      ],
    });

    it('lets Lucy read the cloned repositories, and warns that it is not the work in progress', async () => {
      repositories.result = cloned();

      await ask('¿Es factible el ticket 2?');

      expect(repositories.asked).toEqual(['issue-1']);
      expect(agents.chatWorkdirs).toEqual(['/cache/issue-1']);
      const prompt = agents.chats[0];
      expect(prompt).toContain('acme-web/');
      expect(prompt).toContain('es la rama principal');
      expect(prompt).toContain('workbench/vista-1234abcd'); // dónde está el trabajo de la ejecución
    });

    it('works in an empty folder, without a code section, when there is no way to read the code', async () => {
      repositories.result = null;

      await ask('¿Cómo va?');

      expect(agents.chatWorkdirs).toEqual([undefined]);
      expect(agents.chats[0]).not.toContain('# Código');
    });

    it('says so, and uses an empty folder, when no repository could be cloned', async () => {
      repositories.result = cloned(false);

      await ask('¿Dónde vive esa pantalla?');

      expect(agents.chatWorkdirs).toEqual([undefined]);
      expect(agents.chats[0]).toContain('No hay código disponible');
    });
  });
});
