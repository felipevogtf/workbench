import { ExecutionStatus, ExecutionTicket } from './entities/execution.props';
import {
  extractProposals,
  promisesAButton,
  ProposalContext,
} from './chat-proposals';

const ticket = (
  id: string,
  title: string,
  status: ExecutionTicket['status'] = 'pending',
): ExecutionTicket => ({ id, title, status }) as ExecutionTicket;

const context = (
  status: ExecutionStatus = 'running',
  extra: Partial<ProposalContext> = {},
  tickets: ExecutionTicket[] = [ticket('a', 'API'), ticket('b', 'Pantalla')],
): ProposalContext => ({
  tickets,
  status,
  finalReviewRunning: false,
  repos: ['acme/web', 'acme/api'],
  ...extra,
});

describe('extractProposals — notes', () => {
  it('takes the NOTA lines out of the reply and returns them as proposals', () => {
    const { reply, proposals } = extractProposals(
      [
        'Le dejo una nota a Kiwi.',
        '',
        'NOTA 2: No toques los submódulos.',
        'Avísame si quieres otra.',
      ].join('\n'),
      context(),
    );

    expect(reply).toBe('Le dejo una nota a Kiwi.\n\nAvísame si quieres otra.');
    expect(proposals).toEqual([
      {
        kind: 'note',
        ticketId: 'b',
        ticket: 2,
        title: 'Pantalla',
        text: 'No toques los submódulos.',
        reopen: false,
      },
    ]);
  });

  it('accepts several, in any case and with spaces around', () => {
    const { proposals } = extractProposals(
      '  nota 1 :  Usa el componente X\nNOTA 2: Y',
      context(),
    );

    expect(
      proposals.map((p) => (p.kind === 'note' ? [p.ticketId, p.text] : null)),
    ).toEqual([
      ['a', 'Usa el componente X'],
      ['b', 'Y'],
    ]);
  });

  it('leaves in the reply a line for a ticket that does not exist', () => {
    const { reply, proposals } = extractProposals(
      'NOTA 9: Hola\nNOTA 0: Hola',
      context(),
    );

    expect(proposals).toEqual([]);
    expect(reply).toBe('NOTA 9: Hola\nNOTA 0: Hola');
  });

  it('does not take as a proposal a NOTA that is in the middle of a sentence', () => {
    const { reply, proposals } = extractProposals(
      'Te dejo una NOTA 1: sobre eso',
      context(),
    );

    expect(proposals).toEqual([]);
    expect(reply).toBe('Te dejo una NOTA 1: sobre eso');
  });

  it('offers a note for a ticket that is done only when the execution is completed, and then it reopens it', () => {
    const tickets = [
      ticket('a', 'API', 'done'),
      ticket('b', 'Pantalla', 'done'),
    ];

    const completed = extractProposals(
      'Hay que corregirlo.\nNOTA 1: Cambia la ruta.',
      context('completed', {}, tickets),
    );
    expect(completed.proposals).toEqual([
      expect.objectContaining({ kind: 'note', ticketId: 'a', reopen: true }),
    ]);
    expect(completed.reply).toBe('Hay que corregirlo.');

    // Con la ejecución en marcha nadie volvería a trabajar un ticket hecho: la línea queda a la vista.
    const running = extractProposals(
      'Hay que corregirlo.\nNOTA 1: Cambia la ruta.',
      context('running', {}, tickets),
    );
    expect(running.proposals).toEqual([]);
    expect(running.reply).toBe('Hay que corregirlo.\nNOTA 1: Cambia la ruta.');
  });

  it('keeps at most five proposals', () => {
    const many = Array.from({ length: 8 }, () => 'NOTA 1: x').join('\n');

    expect(extractProposals(many, context()).proposals).toHaveLength(5);
  });

  it('returns the reply untouched when there is nothing to propose', () => {
    expect(extractProposals('Todo bien.', context())).toEqual({
      reply: 'Todo bien.',
      proposals: [],
    });
  });
});

describe('extractProposals — new tickets', () => {
  const line =
    'TICKET simple | Corregir la ruta del multipart | Cambiar /ea por /secured/admin/ea en los dos conf';

  it('turns a TICKET line into a proposal with its level, title and description', () => {
    const { reply, proposals } = extractProposals(
      `Propongo esto:\n${line}`,
      context('completed'),
    );

    expect(reply).toBe('Propongo esto:');
    expect(proposals).toEqual([
      {
        kind: 'ticket',
        level: 'simple',
        title: 'Corregir la ruta del multipart',
        text: 'Cambiar /ea por /secured/admin/ea en los dos conf',
        repo: null,
      },
    ]);
  });

  it('defaults the level to medium, and accepts the repository of the task', () => {
    const { proposals } = extractProposals(
      'TICKET | Ajuste | Hacer el ajuste | ACME/API',
      context('completed'),
    );

    expect(proposals).toEqual([
      expect.objectContaining({
        kind: 'ticket',
        level: 'medium',
        repo: 'acme/api',
      }),
    ]);
  });

  it('ignores a repository that the task does not have', () => {
    const { proposals } = extractProposals(
      'TICKET complex | Ajuste | Hacer el ajuste | otra/cosa',
      context('completed'),
    );

    expect(proposals).toEqual([
      expect.objectContaining({ kind: 'ticket', level: 'complex', repo: null }),
    ]);
  });

  it('does not offer new tickets while the execution is not completed, and leaves the line in the reply', () => {
    const { reply, proposals } = extractProposals(line, context('running'));

    expect(proposals).toEqual([]);
    expect(reply).toBe(line);
  });

  it('keeps a description that has the | character in it, like a regular expression', () => {
    const regex = String.raw`'~^/secured/admin/?\?(.*&)?entity=Advertisement(&|$)' 1;`;

    const { reply, proposals } = extractProposals(
      `Va así:\nTICKET simple | Permitir multipart | Agregar ${regex} al map | acme/web`,
      context('completed'),
    );

    expect(reply).toBe('Va así:');
    expect(proposals).toEqual([
      {
        kind: 'ticket',
        level: 'simple',
        title: 'Permitir multipart',
        text: `Agregar ${regex} al map`,
        repo: 'acme/web',
      },
    ]);
  });

  it('keeps the | in the description when the last field is not a repository', () => {
    const { proposals } = extractProposals(
      'TICKET simple | Ajuste | Cambiar a|b',
      context('completed'),
    );

    expect(proposals).toMatchObject([{ text: 'Cambiar a|b', repo: null }]);
  });

  it('does not take a TICKET line without title and description', () => {
    expect(
      extractProposals('TICKET simple | solo un título', context('completed'))
        .proposals,
    ).toEqual([]);
  });
});

describe('extractProposals — final review', () => {
  it.each(['REVISION FINAL', 'revisión final', '  Revision  Final  '])(
    'offers the final review for «%s» once the execution is completed',
    (text) => {
      const { reply, proposals } = extractProposals(
        `Te sugiero esto.\n${text}`,
        context('completed'),
      );

      expect(proposals).toEqual([{ kind: 'final-review' }]);
      expect(reply).toBe('Te sugiero esto.');
    },
  );

  it('does not offer it before the execution is completed, nor while one is running', () => {
    expect(
      extractProposals('REVISION FINAL', context('running')).proposals,
    ).toEqual([]);
    expect(
      extractProposals(
        'REVISION FINAL',
        context('completed', { finalReviewRunning: true }),
      ).proposals,
    ).toEqual([]);
  });

  it('offers it only once even if she writes it twice', () => {
    const { proposals } = extractProposals(
      'REVISION FINAL\nREVISION FINAL',
      context('completed'),
    );

    expect(proposals).toEqual([{ kind: 'final-review' }]);
  });

  it('does not take as a proposal a sentence that mentions it', () => {
    const { reply, proposals } = extractProposals(
      'Podemos pedir la REVISION FINAL cuando quieras.',
      context('completed'),
    );

    expect(proposals).toEqual([]);
    expect(reply).toContain('REVISION FINAL');
  });
});

describe('extractProposals — however the model formats the line', () => {
  const text = 'Cambia la ruta a /secured/admin/ea';

  it.each([
    ['a bullet', `- NOTA 2: ${text}`],
    ['a numbered item', `1. NOTA 2: ${text}`],
    ['a quote', `> NOTA 2: ${text}`],
    ['bold around the whole line', `**NOTA 2: ${text}**`],
    ['bold around the keyword and the colon', `**NOTA 2:** ${text}`],
    ['bold around the keyword', `**NOTA 2**: ${text}`],
    ['backticks around the whole line', `\`NOTA 2: ${text}\``],
    ['a bullet with bold', `- **NOTA 2:** ${text}`],
  ])('still finds the note when it comes with %s', (_how, line) => {
    const { reply, proposals } = extractProposals(
      `Listo, confirma abajo.\n${line}`,
      context(),
    );

    expect(proposals).toEqual([
      expect.objectContaining({ kind: 'note', ticketId: 'b', text }),
    ]);
    expect(reply).toBe('Listo, confirma abajo.');
  });

  it('keeps the code that the note itself mentions', () => {
    const { proposals } = extractProposals(
      'NOTA 1: Usa `/secured/admin/ea` en el map',
      context(),
    );

    expect(proposals).toEqual([
      expect.objectContaining({ text: 'Usa `/secured/admin/ea` en el map' }),
    ]);
  });

  it('finds a new ticket and the final review written with bold or inside backticks', () => {
    const { proposals } = extractProposals(
      [
        '**TICKET simple | Corregir la ruta | Cambiar /ea**',
        '`REVISION FINAL`',
        '- **REVISION FINAL**',
      ].join('\n'),
      context('completed'),
    );

    expect(proposals).toEqual([
      expect.objectContaining({ kind: 'ticket', title: 'Corregir la ruta' }),
      { kind: 'final-review' },
    ]);
  });

  it('does not leave an empty code block behind when the lines were inside one', () => {
    const { reply, proposals } = extractProposals(
      'Va aquí:\n```\nNOTA 1: Cambia la ruta\n```\nAvísame.',
      context(),
    );

    expect(proposals).toHaveLength(1);
    expect(reply).not.toContain('```');
    expect(reply).toContain('Va aquí:');
    expect(reply).toContain('Avísame.');
  });

  it('leaves a code block that has something else inside untouched', () => {
    const { reply } = extractProposals(
      'Así queda:\n```\nmap $uri $multipart_allowed {}\n```',
      context(),
    );

    expect(reply).toContain('map $uri $multipart_allowed {}');
  });
});

describe('promisesAButton', () => {
  it.each([
    'Confirma la nota con el botón.',
    'Confirma la nota con el botón de abajo.',
    'Para aplicarla, confirma con el botón que te aparece.',
    'Aprieta el botón de abajo para confirmar.',
    'Tienes el botón para confirmar.',
  ])('is true for «%s»', (reply) => {
    expect(promisesAButton(reply)).toBe(true);
  });

  it.each([
    'Usa el botón Reintentar de la pantalla.',
    'El ticket falló por el revisor.',
    'Te explico qué pasó y qué sigue.',
    '',
  ])('is false for «%s»', (reply) => {
    expect(promisesAButton(reply)).toBe(false);
  });
});
