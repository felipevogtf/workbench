import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AgentsApi } from '../../../ai-agents/data-access/agents.api';
import { ExecutionChatStore } from '../../data-access/execution-chat.store';
import { ExecutionsApi } from '../../data-access/executions.api';
import { ExecutionChat } from './execution-chat';

const ask = (id: string, text = '¿Todas las pantallas o solo el formulario?') => ({
  id,
  from: 'David',
  ticket: 2,
  text,
});

describe('ExecutionChat', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ExecutionChatStore,
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
});
