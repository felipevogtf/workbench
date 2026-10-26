import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AgentsApi } from '../../../ai-agents/data-access/agents.api';
import { ExecutionChatStore } from '../../data-access/execution-chat.store';
import { ExecutionStore } from '../../data-access/execution.store';
import { ExecutionsApi } from '../../data-access/executions.api';
import { ChatProposal } from '../../models/execution';
import { ExecutionChat } from './execution-chat';

const ask = (id: string, text = '¿Todas las pantallas o solo el formulario?') => ({
  id,
  from: 'David',
  ticket: 2,
  text,
});

const proposal = {
  kind: 'note' as const,
  reopen: false,
  ticketId: 't2',
  ticket: 2,
  title: 'Pantalla',
  text: 'No toques los submódulos.',
};

describe('ExecutionChat', () => {
  let addNote: ReturnType<typeof vi.fn<(ticketId: string, text: string) => Promise<boolean>>>;
  let retry: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  let reopenTicket: ReturnType<typeof vi.fn<(ticketId: string, text: string) => Promise<boolean>>>;
  let addTickets: ReturnType<typeof vi.fn<(tickets: unknown[]) => Promise<boolean>>>;
  let requestFinalReview: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  let detail: WritableSignal<{
    status: string;
    error: string | null;
    finalReview?: unknown;
  } | null>;

  beforeEach(() => {
    addNote = vi.fn(() => Promise.resolve(true));
    retry = vi.fn(() => Promise.resolve(true));
    reopenTicket = vi.fn(() => Promise.resolve(true));
    addTickets = vi.fn(() => Promise.resolve(true));
    requestFinalReview = vi.fn(() => Promise.resolve(true));
    detail = signal(null);
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ExecutionChatStore,
        {
          provide: ExecutionStore,
          useValue: {
            acting: signal(false),
            addNote,
            retry,
            reopenTicket,
            addTickets,
            requestFinalReview,
            detail,
          },
        },
        { provide: ExecutionsApi, useValue: { chat: () => of({ reply: 'ok' }) } },
        { provide: AgentsApi, useValue: { list: () => of([]) } },
      ],
    });
  });

  async function render(questions: ReturnType<typeof ask>[]) {
    const fixture = TestBed.createComponent(ExecutionChat);
    fixture.componentRef.setInput('executionId', 'e1');
    fixture.componentRef.setInput('questions', questions);
    await fixture.whenStable();
    return { fixture, chat: TestBed.inject(ExecutionChatStore) };
  }

  it('tells about a question that arrives while the page is open, as unread when the chat is closed', async () => {
    const { fixture, chat } = await render([]);

    fixture.componentRef.setInput('questions', [ask('q1')]);
    await fixture.whenStable();

    expect(chat.messages()).toHaveLength(1);
    expect(chat.messages()[0].role).toBe('assistant');
    expect(chat.messages()[0].content).toContain('David');
    expect(chat.messages()[0].content).toContain('ticket 2');
    expect(chat.unread()).toBe(1);
  });

  it('does not announce again a question it already told about', async () => {
    const { fixture, chat } = await render([]);

    fixture.componentRef.setInput('questions', [ask('q1')]);
    await fixture.whenStable();
    fixture.componentRef.setInput('questions', [ask('q1'), ask('q2', 'Otra duda')]);
    await fixture.whenStable();

    expect(chat.messages()).toHaveLength(2);
    expect(chat.unread()).toBe(2);
  });

  it('does not announce the questions that were already there when the page opened', async () => {
    const { chat } = await render([ask('q1')]);

    expect(chat.messages()).toHaveLength(0);
    expect(chat.unread()).toBe(0);
  });

  describe('the doubts that the agents leave', () => {
    const doubt = (id: string, text = 'Supuse que va solo en el formulario.') => ({
      id,
      from: 'David',
      ticket: 2,
      text,
    });

    async function renderWith(doubts: ReturnType<typeof doubt>[]) {
      const fixture = TestBed.createComponent(ExecutionChat);
      fixture.componentRef.setInput('executionId', 'e1');
      fixture.componentRef.setInput('doubts', doubts);
      await fixture.whenStable();
      return { fixture, chat: TestBed.inject(ExecutionChatStore) };
    }

    it('comments a doubt that arrives while the page is open, as unread, inviting to talk it over', async () => {
      const { fixture, chat } = await renderWith([]);

      fixture.componentRef.setInput('doubts', [doubt('d1')]);
      await fixture.whenStable();

      expect(chat.messages()).toHaveLength(1);
      expect(chat.messages()[0].content).toContain('David');
      expect(chat.messages()[0].content).toContain('ticket 2');
      expect(chat.messages()[0].content).toContain('Supuse que va solo en el formulario.');
      expect(chat.messages()[0].content).toContain('¿Lo dejamos así?');
      expect(chat.unread()).toBe(1);
    });

    it('does not comment again a doubt it already commented, nor the ones there when the page opened', async () => {
      const { fixture, chat } = await renderWith([doubt('viejo')]);
      expect(chat.messages()).toHaveLength(0);

      fixture.componentRef.setInput('doubts', [doubt('viejo'), doubt('d1')]);
      await fixture.whenStable();
      fixture.componentRef.setInput('doubts', [doubt('viejo'), doubt('d1')]);
      await fixture.whenStable();

      expect(chat.messages()).toHaveLength(1);
    });
  });

  describe('when the execution fails', () => {
    const state = (status: string, error: string | null = null) => detail.set({ status, error });

    it('says so in the chat, with the error, when it fails while the page is open', async () => {
      state('running');
      const { fixture, chat } = await render([]);

      state('failed', 'git commit falló: modified content');
      await fixture.whenStable();

      expect(chat.messages()).toHaveLength(1);
      expect(chat.messages()[0].content).toContain('La ejecución falló');
      expect(chat.messages()[0].content).toContain('git commit falló');
      expect(chat.unread()).toBe(1);
    });

    it('does not say it again for the same failure, but does after a retry fails again', async () => {
      state('running');
      const { fixture, chat } = await render([]);

      state('failed', 'uno');
      await fixture.whenStable();
      state('failed', 'uno');
      await fixture.whenStable();
      expect(chat.messages()).toHaveLength(1);

      state('running');
      await fixture.whenStable();
      state('failed', 'dos');
      await fixture.whenStable();
      expect(chat.messages()).toHaveLength(2);
    });

    it('stays quiet about an execution that was already failed when the page opened', async () => {
      state('failed', 'viejo');
      const { chat } = await render([]);

      expect(chat.messages()).toHaveLength(0);
    });
  });

  describe('the notes that Lucy proposes for an agent', () => {
    const buttons = (fixture: { nativeElement: HTMLElement }) => [
      ...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.proposal button'),
    ];

    it('keeps the proposals that come with her answer, and clears them when the user asks again', async () => {
      const api = TestBed.inject(ExecutionsApi) as unknown as { chat: () => unknown };
      api.chat = () => of({ reply: 'Te dejo una nota.', proposals: [proposal] });
      const { chat } = await render([]);

      await chat.send('Dile a David que no toque los submódulos');
      expect(chat.proposals()).toEqual([proposal]);

      api.chat = () => of({ reply: 'Nada más.', proposals: [] });
      await chat.send('Gracias');
      expect(chat.proposals()).toEqual([]);
    });

    it('shows each one with a button, and leaves the note on the ticket only when the user confirms', async () => {
      const { fixture, chat } = await render([]);
      chat.toggle();
      chat.proposals.set([proposal]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('No toques los submódulos.');
      expect(fixture.nativeElement.textContent).toContain('Nota para el ticket 2');
      expect(addNote).not.toHaveBeenCalled();

      buttons(fixture)[0].click();
      await fixture.whenStable();

      expect(addNote).toHaveBeenCalledWith('t2', 'No toques los submódulos.');
      expect(chat.proposals()).toEqual([]);
      expect(chat.messages().at(-1)?.content).toContain('ticket 2');
    });

    it('offers to retry too only when the execution failed, and does it after leaving the note', async () => {
      detail.set({ status: 'running', error: null });
      const { fixture, chat } = await render([]);
      chat.toggle();
      chat.proposals.set([proposal]);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(buttons(fixture)).toHaveLength(1);

      detail.set({ status: 'failed', error: 'x' });
      fixture.detectChanges();
      await fixture.whenStable();
      const both = buttons(fixture);
      expect(both.map((button) => button.textContent?.trim())).toEqual([
        'Dejar la nota',
        'Dejar la nota y reintentar',
      ]);

      both[1].click();
      await fixture.whenStable();

      expect(addNote).toHaveBeenCalledWith('t2', 'No toques los submódulos.');
      expect(retry).toHaveBeenCalledTimes(1);
      expect(chat.messages().at(-1)?.content).toContain('Volví a lanzar');
    });

    it('renders the note as Markdown and folds a long one behind «Ver el texto completo»', async () => {
      const long = {
        ...proposal,
        text: `Cierra lo pendiente en \`docker/nginx/dsy.conf\`. ${'Detalle largo. '.repeat(30)}`,
      };
      const { fixture, chat } = await render([]);
      chat.toggle();
      chat.proposals.set([long]);
      fixture.detectChanges();
      await fixture.whenStable();
      const element: HTMLElement = fixture.nativeElement;
      const text = () => element.querySelector('.proposal__text');
      const more = () => element.querySelector<HTMLButtonElement>('.proposal__more');

      expect(text()?.querySelector('code')?.textContent).toBe('docker/nginx/dsy.conf');
      expect(text()?.classList.contains('proposal__text--clamped')).toBe(true);
      expect(more()?.textContent?.trim()).toBe('Ver el texto completo');

      more()!.click();
      fixture.detectChanges();
      expect(text()?.classList.contains('proposal__text--clamped')).toBe(false);
      expect(more()?.textContent?.trim()).toBe('Ver menos');
    });

    it('does not fold a short note', async () => {
      const { fixture, chat } = await render([]);
      chat.toggle();
      chat.proposals.set([proposal]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.proposal__more')).toBeNull();
    });

    it('keeps the proposal when the note could not be saved', async () => {
      addNote.mockResolvedValue(false);
      const { fixture, chat } = await render([]);
      chat.toggle();
      chat.proposals.set([proposal]);
      fixture.detectChanges();
      await fixture.whenStable();

      buttons(fixture)[0].click();
      await fixture.whenStable();

      expect(chat.proposals()).toEqual([proposal]);
    });
  });

  describe('what Lucy proposes once the execution is completed', () => {
    const buttons = (fixture: { nativeElement: HTMLElement }) =>
      [...fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.proposal button')].filter(
        (button) => !button.classList.contains('proposal__more'),
      );

    async function open(proposals: ChatProposal[]) {
      const { fixture, chat } = await render([]);
      chat.toggle();
      chat.proposals.set(proposals);
      fixture.detectChanges();
      await fixture.whenStable();
      return { fixture, chat };
    }

    it('reopens a done ticket with the note, only when the user confirms', async () => {
      const reopening = { ...proposal, reopen: true };
      const { fixture, chat } = await open([reopening]);

      expect(fixture.nativeElement.textContent).toContain('Reabrir el ticket 2 con esta nota');
      expect(reopenTicket).not.toHaveBeenCalled();
      expect(buttons(fixture).map((button) => button.textContent?.trim())).toEqual([
        'Reabrir el ticket con esta nota',
      ]);

      buttons(fixture)[0].click();
      await fixture.whenStable();

      expect(reopenTicket).toHaveBeenCalledWith('t2', 'No toques los submódulos.');
      expect(addNote).not.toHaveBeenCalled();
      expect(chat.proposals()).toEqual([]);
      expect(chat.messages().at(-1)?.content).toContain('reabrí el ticket 2');
    });

    it('does not offer to retry together with reopening', async () => {
      detail.set({ status: 'failed', error: 'x' });
      const { fixture } = await open([{ ...proposal, reopen: true }]);

      expect(buttons(fixture)).toHaveLength(1);
    });

    it('adds the ticket she proposes, with its level and repository, when the user confirms', async () => {
      const ticket = {
        kind: 'ticket' as const,
        title: 'Corregir la ruta',
        text: 'Cambiar /ea por /secured/admin/ea',
        level: 'simple' as const,
        repo: 'acme/api',
      };
      const { fixture, chat } = await open([ticket]);

      expect(fixture.nativeElement.textContent).toContain(
        'Ticket nuevo (simple): Corregir la ruta',
      );
      expect(addTickets).not.toHaveBeenCalled();

      buttons(fixture)[0].click();
      await fixture.whenStable();

      expect(addTickets).toHaveBeenCalledWith([
        {
          title: 'Corregir la ruta',
          description: 'Cambiar /ea por /secured/admin/ea',
          level: 'simple',
          repo: 'acme/api',
        },
      ]);
      expect(chat.proposals()).toEqual([]);
      expect(chat.messages().at(-1)?.content).toContain('sumé el ticket «Corregir la ruta»');
    });

    it('does not send a repository when the proposal has none', async () => {
      const { fixture } = await open([
        { kind: 'ticket', title: 'Ajuste', text: 'Hacerlo', level: 'medium', repo: null },
      ]);

      buttons(fixture)[0].click();
      await fixture.whenStable();

      expect(addTickets).toHaveBeenCalledWith([
        { title: 'Ajuste', description: 'Hacerlo', level: 'medium' },
      ]);
    });

    it('asks for the final review when the user confirms', async () => {
      const { fixture, chat } = await open([{ kind: 'final-review' }]);

      expect(fixture.nativeElement.textContent).toContain('Revisión final de toda la rama');
      expect(requestFinalReview).not.toHaveBeenCalled();

      buttons(fixture)[0].click();
      await fixture.whenStable();

      expect(requestFinalReview).toHaveBeenCalledTimes(1);
      expect(chat.proposals()).toEqual([]);
      expect(chat.messages().at(-1)?.content).toContain('Pedí la revisión final');
    });

    it('keeps what she proposed when it could not be done', async () => {
      requestFinalReview.mockResolvedValue(false);
      addTickets.mockResolvedValue(false);
      reopenTicket.mockResolvedValue(false);
      const proposals: ChatProposal[] = [
        { kind: 'final-review' },
        { kind: 'ticket', title: 'T', text: 'x', level: 'simple', repo: null },
        { ...proposal, reopen: true },
      ];
      const { fixture, chat } = await open(proposals);

      for (const button of buttons(fixture)) {
        button.click();
        await fixture.whenStable();
      }

      expect(chat.proposals()).toEqual(proposals);
    });
  });

  describe('when the final review finishes', () => {
    const review = (status: string, extra: Record<string, unknown> = {}) => ({
      status,
      requestedAt: '2026-10-26T00:00:00Z',
      finishedAt: null,
      summary: null,
      findings: [],
      error: null,
      ...extra,
    });
    const state = (finalReview?: unknown) =>
      detail.set({ status: 'completed', error: null, finalReview });

    it('tells in the chat, with the summary and how many findings, when it finishes with the page open', async () => {
      state(review('running'));
      const { fixture, chat } = await render([]);

      state(
        review('done', {
          summary: 'Falta cubrir una parte del plan',
          findings: [{ severity: 'high', file: null, issue: 'x', suggestion: 'y' }],
        }),
      );
      await fixture.whenStable();

      expect(chat.messages()).toHaveLength(1);
      expect(chat.messages()[0].content).toContain('La revisión final terminó');
      expect(chat.messages()[0].content).toContain('Falta cubrir una parte del plan');
      expect(chat.messages()[0].content).toContain('Encontró 1 hallazgo;');
      expect(chat.unread()).toBe(1);
    });

    it('says it found nothing when the report is empty', async () => {
      state(review('running'));
      const { fixture, chat } = await render([]);

      state(review('done', { summary: 'Todo en orden' }));
      await fixture.whenStable();

      expect(chat.messages()[0].content).toContain('No encontró problemas');
    });

    it('says so when it fails, with the error', async () => {
      state(review('running'));
      const { fixture, chat } = await render([]);

      state(review('failed', { error: 'el runner no respondió' }));
      await fixture.whenStable();

      expect(chat.messages()[0].content).toContain('La revisión final falló');
      expect(chat.messages()[0].content).toContain('el runner no respondió');
    });

    it('stays quiet about a report that was already there when the page opened, and about one still running', async () => {
      state(review('done', { summary: 'Viejo' }));
      const { fixture, chat } = await render([]);
      expect(chat.messages()).toHaveLength(0);

      state(review('running'));
      await fixture.whenStable();
      expect(chat.messages()).toHaveLength(0);
    });
  });
});
