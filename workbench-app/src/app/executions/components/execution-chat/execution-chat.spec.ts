import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AgentsApi } from '../../../ai-agents/data-access/agents.api';
import { ExecutionChatStore } from '../../data-access/execution-chat.store';
import { ExecutionStore } from '../../data-access/execution.store';
import { ExecutionsApi } from '../../data-access/executions.api';
import { ExecutionChat } from './execution-chat';

const ask = (id: string, text = '¿Todas las pantallas o solo el formulario?') => ({
  id,
  from: 'David',
  ticket: 2,
  text,
});

const proposal = {
  ticketId: 't2',
  ticket: 2,
  title: 'Pantalla',
  text: 'No toques los submódulos.',
};

describe('ExecutionChat', () => {
  let addNote: ReturnType<typeof vi.fn<(ticketId: string, text: string) => Promise<boolean>>>;

  beforeEach(() => {
    addNote = vi.fn(() => Promise.resolve(true));
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ExecutionChatStore,
        { provide: ExecutionStore, useValue: { acting: signal(false), addNote } },
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
});
