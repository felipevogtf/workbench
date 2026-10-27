import { ExecutionTicket } from './entities/execution.props';
import {
  buildDevelopPrompt,
  buildFinalReviewPrompt,
  buildPullRequestDescription,
  buildReviewPrompt,
  buildTicketsPrompt,
} from './prompts';

const ticket = (files?: string[]): ExecutionTicket => ({
  id: 't1',
  title: 'Cambiar el ícono',
  description: 'Usar el ícono nuevo',
  criteria: ['Se ve el ícono'],
  ...(files ? { files } : {}),
  level: 'simple',
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
});

describe('the review prompt', () => {
  const prompt = buildReviewPrompt({
    ticket: ticket(),
    repoName: 'org/repo',
    from: 'abc123',
    developerSummary: null,
  });

  it('tells the reviewer to run the tests, lint and build, without changing files', () => {
    expect(prompt).toContain('`npm test`, `npm run lint`, `npm run build`');
    expect(prompt).toContain('No cambies archivos');
  });

  it('does not block the approval for errors in files the ticket does not touch', () => {
    expect(prompt).toContain('git diff --stat');
    expect(prompt).toContain('ya estaban antes y no bloquean la aprobación');
    expect(prompt).toContain('dilo en `doubts`');
  });
});

describe('the comments in the code', () => {
  const develop = buildDevelopPrompt({
    ticket: ticket(),
    index: 1,
    total: 1,
    plan: 'plan',
    repoName: 'org/repo',
  });

  it('tells the developer not to narrate the code or the change, and to keep a comment only for a why that is not visible', () => {
    expect(develop).toContain('No comentes lo que el código ya dice');
    expect(develop).toContain('no narres el');
    expect(develop).toContain('Un comentario solo si explica un porqué');
    expect(develop).toContain('Una línea, sin adornos');
  });

  it('tells the developer to leave the existing comments alone and to reuse what exists', () => {
    expect(develop).toContain('No borres ni reescribas comentarios');
    expect(develop).toContain('reutilízalo');
    expect(develop).toContain('lo mínimo nunca es dejar uno sin cumplir');
  });

  it('asks the reviewer to flag the comments the diff adds, and the ones it deletes', () => {
    const review = buildReviewPrompt({
      ticket: ticket(),
      repoName: 'org/repo',
      from: 'abc',
      developerSummary: null,
    });

    expect(review).toContain('Mira los comentarios que agrega el diff');
    expect(review).toContain('pide quitarlos');
    expect(review).toContain('restaurar los comentarios');
  });
});

describe('the recipes in the prompts', () => {
  const recipe = '## Receta de org/repo\nPara probar: docker compose up';

  it.each([
    [
      'tickets',
      () =>
        buildTicketsPrompt({
          taskName: 'T',
          taskDescription: null,
          plan: 'plan',
          repoName: 'org/repo',
          recipe,
        }),
    ],
    [
      'develop',
      () =>
        buildDevelopPrompt({
          ticket: ticket(),
          index: 1,
          total: 1,
          plan: 'plan',
          repoName: 'org/repo',
          recipe,
        }),
    ],
    [
      'review',
      () =>
        buildReviewPrompt({
          ticket: ticket(),
          repoName: 'org/repo',
          from: 'abc',
          developerSummary: null,
          recipe,
        }),
    ],
  ])('shows the recipe in the %s prompt, as information', (_kind, build) => {
    const prompt = build();

    expect(prompt).toContain('# Recetas del proyecto');
    expect(prompt).toContain('Para probar: docker compose up');
    expect(prompt).toContain('es información, no cambia el formato');
  });

  it('adds no section without a recipe', () => {
    const prompt = buildDevelopPrompt({
      ticket: ticket(),
      index: 1,
      total: 1,
      plan: 'plan',
      repoName: 'org/repo',
      recipe: null,
    });

    expect(prompt).not.toContain('# Recetas del proyecto');
  });
});

describe('ticket files', () => {
  it('asks Lucy for the files of each ticket', () => {
    const prompt = buildTicketsPrompt({
      taskName: 'T',
      taskDescription: null,
      plan: 'plan',
      repoName: 'org/repo',
    });

    expect(prompt).toContain('"files":["ruta/al/archivo"]');
  });

  it('gives the developer the files as a hint where to start, not a limit', () => {
    const prompt = buildDevelopPrompt({
      ticket: ticket(['src/app/icon.ts', 'src/theme.scss']),
      index: 1,
      total: 1,
      plan: 'plan',
      repoName: 'org/repo',
    });

    expect(prompt).toContain('- src/app/icon.ts');
    expect(prompt).toContain('- src/theme.scss');
    expect(prompt).toContain('es una pista, no un límite');
  });

  it('shows them to the reviewer too', () => {
    const prompt = buildReviewPrompt({
      ticket: ticket(['src/app/icon.ts']),
      repoName: 'org/repo',
      from: 'abc123',
      developerSummary: null,
    });

    expect(prompt).toContain('- src/app/icon.ts');
  });

  it('adds nothing for a ticket without files', () => {
    const prompt = buildDevelopPrompt({
      ticket: ticket(),
      index: 1,
      total: 1,
      plan: 'plan',
      repoName: 'org/repo',
    });

    expect(prompt).not.toContain('Archivos previstos');
  });
});

describe('the final review prompt', () => {
  const tickets = [
    {
      ...ticket(['src/a.ts']),
      title: 'API de órdenes',
      status: 'done' as const,
      criteria: ['Responde 200'],
      summary: 'Agregué el endpoint',
      doubts: [
        {
          id: 'd1',
          at: '2026-10-26T00:00:00Z',
          from: 'Kiwi',
          text: 'Supuse /ea',
        },
      ],
    },
  ];
  const build = (
    extra: Partial<Parameters<typeof buildFinalReviewPrompt>[0]> = {},
  ) =>
    buildFinalReviewPrompt({
      taskName: 'Vista de órdenes',
      plan: '## Pasos\nHacer la vista',
      tickets,
      targets: [{ repoName: 'acme/web', baseBranch: 'main', primary: true }],
      ...extra,
    });

  it('gives the reviewer the plan, the tickets with their criteria, summary and doubts', () => {
    const prompt = build();

    expect(prompt).toContain('«Vista de órdenes»');
    expect(prompt).toContain('Hacer la vista');
    expect(prompt).toContain('1. API de órdenes (done)');
    expect(prompt).toContain('- Responde 200');
    expect(prompt).toContain('Resumen del desarrollador: Agregué el endpoint');
    expect(prompt).toContain('Duda de Kiwi: Supuse /ea');
  });

  it('points at the diff of the whole branch against its base', () => {
    expect(build()).toContain('git diff origin/main...HEAD');
    expect(
      build({
        targets: [
          { repoName: 'acme/web', baseBranch: 'develop', primary: true },
        ],
      }),
    ).toContain('git diff origin/develop...HEAD');
    // Sin la rama base conocida se supone main.
    expect(
      build({
        targets: [{ repoName: 'acme/web', baseBranch: null, primary: true }],
      }),
    ).toContain('origin/main...HEAD');
  });

  it('lists the other repositories as read-only folders', () => {
    const prompt = build({
      targets: [
        { repoName: 'acme/web', baseBranch: 'main', primary: true },
        { repoName: 'acme/api', baseBranch: 'main', primary: false },
      ],
    });

    expect(prompt).toContain('- acme/api: {{dir:acme/api}} (solo para leer');
  });

  it('asks for a JSON report, without changing files, and tells how to treat errors that were already there', () => {
    const prompt = build();

    expect(prompt).toContain('"findings":[{"severity":"high|medium|low"');
    expect(prompt).toContain('No cambies archivos');
    expect(prompt).toContain('ya estaban antes');
    expect(prompt).toContain('`npm test`, `npm run lint`, `npm run build`');
  });

  it('shows the recipe when there is one, and nothing when there is not', () => {
    expect(build({ recipe: '## Receta de acme/web\nPara probar' })).toContain(
      '# Recetas del proyecto',
    );
    expect(build()).not.toContain('# Recetas del proyecto');
  });
});

describe('the description of the pull request', () => {
  it('lists what the reviewer still asked for when the reviews ran out, and nothing otherwise', () => {
    const clean = { ...ticket(), status: 'done' as const };
    const pending = {
      ...ticket(),
      title: 'Documentar el modo rechazo',
      status: 'done' as const,
      feedback: ['Cambia el comando por uno que sí muestre el valor'],
    };

    const withPending = buildPullRequestDescription({
      taskName: 'Tarea',
      tickets: [clean, pending],
    });
    expect(withPending).toContain('### Pendiente de revisión humana');
    expect(withPending).toContain('Documentar el modo rechazo');
    expect(withPending).toContain(
      'Cambia el comando por uno que sí muestre el valor',
    );

    expect(
      buildPullRequestDescription({ taskName: 'Tarea', tickets: [clean] }),
    ).not.toContain('Pendiente de revisión humana');
  });
});
