import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AgentsStore } from '@ai-agents/index';
import { IssueExecutionsStore } from '@executions/index';
import { IssuesStore } from '@tasks/index';
import { PlansStore } from '@tasks/data-access/plans.store';
import { TaskChatStore } from '@tasks/data-access/task-chat.store';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Toast } from '@shared/ui/toast/toast';
import { OrganizerStore } from '../../data-access/organizer.store';
import { OrganizerPage } from './organizer-page';

const say = (role: 'user' | 'assistant', content: string) => ({ role, content });

describe('OrganizerPage planning', () => {
  let messages: ReturnType<typeof say>[];
  let chat: {
    messages: ReturnType<typeof signal<ReturnType<typeof say>[]>>;
    snapshot: ReturnType<typeof vi.fn>;
    bind: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    sending: ReturnType<typeof signal<boolean>>;
  };
  let generate: ReturnType<typeof vi.fn>;

  function create(): { createPlan(): Promise<void>; plannedKey(): string } {
    const session = {
      id: 's1',
      title: 'Tarea',
      kind: 'task',
      groupIssueId: 'g1',
      notes: null,
      members: [],
      createdAt: '',
    };
    generate = vi.fn(() => Promise.resolve(true));
    chat = {
      messages: signal(messages),
      snapshot: vi.fn(() => chat.messages()),
      bind: vi.fn(),
      clear: vi.fn(),
      sending: signal(false),
    };
    const fakes = [
      {
        provide: OrganizerStore,
        useValue: {
          current: signal(session),
          error: signal(null),
          saving: signal(false),
          open: () => Promise.resolve(true),
        },
      },
      { provide: AgentsStore, useValue: { load: vi.fn(), assistantOf: () => null } },
      { provide: IssuesStore, useValue: { load: vi.fn(), issueById: signal(new Map()) } },
      { provide: ConfirmDialog, useValue: {} },
      { provide: Toast, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: Router, useValue: {} },
    ];
    TestBed.configureTestingModule({ providers: fakes });
    TestBed.overrideComponent(OrganizerPage, {
      set: {
        imports: [],
        template: '',
        templateUrl: undefined,
        styleUrl: undefined,
        providers: [
          {
            provide: PlansStore,
            useValue: {
              plans: signal([]),
              requesting: signal(false),
              active: signal(null),
              load: vi.fn(),
              generate,
            },
          },
          { provide: TaskChatStore, useValue: chat },
          { provide: IssueExecutionsStore, useValue: { executions: signal([]), load: vi.fn() } },
        ],
      },
    });
    const fixture = TestBed.createComponent(OrganizerPage);
    fixture.componentRef.setInput('id', 's1');
    return fixture.componentInstance as unknown as ReturnType<typeof create>;
  }

  beforeEach(() => {
    localStorage.clear();
    messages = [
      say('user', 'El reporte falla offline'),
      say('assistant', 'Lo reviso'),
      say('user', 'Y también el PDF'),
    ];
  });

  it('keeps the conversation after asking for the plan', async () => {
    const page = create();

    await page.createPlan();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(chat.clear).not.toHaveBeenCalled();
    expect(chat.messages()).toHaveLength(3);
  });

  it('sends the whole conversation the first time', async () => {
    const page = create();

    await page.createPlan();

    expect(generate).toHaveBeenCalledWith({ messages });
  });

  it('on the next replan sends only what was said after the last plan', async () => {
    const page = create();
    await page.createPlan();
    chat.messages.set([
      ...messages,
      say('assistant', 'Hecho'),
      say('user', 'Agrega un paso de pruebas'),
    ]);

    await page.createPlan();

    expect(generate).toHaveBeenLastCalledWith({
      messages: [say('assistant', 'Hecho'), say('user', 'Agrega un paso de pruebas')],
    });
  });

  it('does not count a failed request as planned', async () => {
    const page = create();
    generate.mockResolvedValueOnce(false);

    await page.createPlan();
    await page.createPlan();

    expect(generate).toHaveBeenLastCalledWith({ messages });
  });
});
