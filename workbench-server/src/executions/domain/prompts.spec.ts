import { ExecutionTicket } from './entities/execution.props';
import {
  buildDevelopPrompt,
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
