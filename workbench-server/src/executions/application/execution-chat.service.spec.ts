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
    question: null,
    decisions: [],
    questionsAsked: 0,
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

  it('lets her propose a note for an agent, which comes back apart from her text', async () => {
    agents.chatReply =
      'Le dejo esto a Rebecca.\nNOTA 1: No toques los submódulos.';

    const answer = await ask('Dile a Rebecca que no toque los submódulos');

    expect(agents.chats[0]).toContain('NOTA <número del ticket>');
    expect(answer.reply).toBe('Le dejo esto a Rebecca.');
    expect(answer.proposals).toEqual([
      {
        kind: 'note',
        ticketId: 'a',
        ticket: 1,
        title: 'API de órdenes',
        text: 'No toques los submódulos.',
        reopen: false,
      },
    ]);
  });

  it('tells her what she may propose once the execution is completed: reopen a ticket, add tickets, the final review', async () => {
    await ask('Hola');

    const prompt = agents.chats[0];
    expect(prompt).toContain('una nota para un ticket «hecho» lo REABRE');
    expect(prompt).toContain(
      'TICKET <simple|medium|complex> | <título> | <descripción',
    );
    expect(prompt).toContain('exactamente `REVISION FINAL`');
  });

  it('does not turn into a button the note she wrote for a done ticket while the execution is not completed', async () => {
    execution.ticket('a').status = 'done';
    await executions.save(execution);
    agents.chatReply = 'Hay que corregirlo.\nNOTA 1: Cambia la ruta.';

    const answer = await ask('Corrígelo');

    expect(answer.proposals).toEqual([]);
    expect(answer.reply).toContain('NOTA 1: Cambia la ruta.');
  });

  describe('once the execution is completed', () => {
    beforeEach(async () => {
      execution.ticket('a').status = 'done';
      execution.ticket('b').status = 'done';
      execution.complete('https://bitbucket.org/acme/web/pull/7');
      await executions.save(execution);
    });

    it('turns her note for a done ticket into a proposal that reopens it', async () => {
      agents.chatReply = 'Lo reabro.\nNOTA 1: Cambia la ruta.';

      const answer = await ask('Corrígelo');

      expect(answer.proposals).toEqual([
        expect.objectContaining({ kind: 'note', ticketId: 'a', reopen: true }),
      ]);
      expect(answer.reply).toBe('Lo reabro.');
    });

    it('lets her propose a new ticket and the final review', async () => {
      agents.chatReply = [
        'Propongo esto.',
        'TICKET simple | Corregir la ruta | Cambiar /ea por /secured/admin/ea',
        'REVISION FINAL',
      ].join('\n');

      const answer = await ask('Agrega un hotfix y revisa todo');

      expect(answer.proposals).toEqual([
        {
          kind: 'ticket',
          level: 'simple',
          title: 'Corregir la ruta',
          text: 'Cambiar /ea por /secured/admin/ea',
          repo: null,
        },
        { kind: 'final-review' },
      ]);
      expect(answer.reply).toBe('Propongo esto.');
    });

    it('does not offer the final review again while one is running', async () => {
      execution.startFinalReview();
      await executions.save(execution);
      agents.chatReply = 'Va en camino.\nREVISION FINAL';

      const answer = await ask('Revísalo');

      expect(answer.proposals).toEqual([]);
      expect(agents.chats[0]).toContain('Se pidió y todavía está en marcha');
    });

    it('shows her the report of the final review, to talk it over with the user', async () => {
      execution.startFinalReview();
      execution.finishFinalReview({
        summary: 'Falta cubrir una parte del plan',
        findings: [
          {
            severity: 'high',
            file: 'docker/nginx/dsy.conf',
            issue: 'La ruta /ea no existe',
            suggestion: 'Usar /secured/admin/ea',
          },
        ],
      });
      await executions.save(execution);

      await ask('¿Qué encontró la revisión final?');

      const prompt = agents.chats[0];
      expect(prompt).toContain(
        '# Revisión final (informe del revisor, ya hecho)',
      );
      expect(prompt).toContain('Falta cubrir una parte del plan');
      expect(prompt).toContain(
        '1. [high] docker/nginx/dsy.conf: La ruta /ea no existe → Usar /secured/admin/ea',
      );
    });

    it('says so when the final review failed', async () => {
      execution.startFinalReview();
      execution.failFinalReview('el runner no respondió');
      await executions.save(execution);

      await ask('¿Y la revisión final?');

      expect(agents.chats[0]).toContain('Falló: el runner no respondió');
    });
  });

  it('returns no proposals when she only talks', async () => {
    agents.chatReply = 'Falló por el revisor.';

    expect((await ask('¿Por qué falló?')).proposals).toEqual([]);
  });

  it('shows her the doubts that the agents left, to talk them over with the user', async () => {
    execution.ticket('a').doubts = [
      {
        id: 'd1',
        at: '2026-10-26T00:00:00Z',
        from: 'Rebecca',
        text: 'Supuse que va en el AST',
      },
    ];
    await executions.save(execution);

    await ask('Hola');

    expect(agents.chats[0]).toContain(
      'Duda de Rebecca (sin resolver con el usuario): Supuse que va en el AST',
    );
  });

  it('shows her the notes already left on a ticket', async () => {
    execution.ticket('a').notes = [
      { at: '2026-10-26T00:00:00Z', from: 'user', text: 'Usa el componente X' },
    ];
    await executions.save(execution);

    await ask('Hola');

    expect(agents.chats[0]).toContain(
      'Nota para el agente (del usuario): Usa el componente X',
    );
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
