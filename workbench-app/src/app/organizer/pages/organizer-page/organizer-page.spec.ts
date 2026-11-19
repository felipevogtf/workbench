import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AgentsStore } from '@ai-agents/index';
import { IssueExecutionsStore } from '@executions/index';
import { ProjectsApi } from '@projects/index';
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
    unbind: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    sending: ReturnType<typeof signal<boolean>>;
    onUpdatesPlan: ((rebuild: boolean) => void) | null;
    provision: (() => Promise<string | null>) | null;
  };
  let generate: ReturnType<typeof vi.fn>;
  let removeAll: ReturnType<typeof vi.fn>;
  let ask: ReturnType<typeof vi.fn>;
  let lastFixture: ComponentFixture<OrganizerPage>;
  let store: {
    current: ReturnType<typeof signal<Record<string, unknown> | null>>;
    sessions: ReturnType<typeof signal<unknown[]>>;
    load: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    adopt: ReturnType<typeof vi.fn>;
    clearCurrent: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    setProjects: ReturnType<typeof vi.fn>;
    setMembers: ReturnType<typeof vi.fn>;
    addTicket: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn>; navigateByUrl: ReturnType<typeof vi.fn> };
  let toastError: ReturnType<typeof vi.fn>;

  interface Page {
    canPlan(): boolean;
    changeProjects(repos: string[]): Promise<void>;
    changeMembers(ids: string[]): Promise<void>;
    createTicket(name: string): Promise<void>;
    createPlan(): Promise<void>;
    isDraft(): boolean;
    view(): { title: string; projectRepos: string[] } | null;
    plannedKey(): string;
    reset(): Promise<void>;
    side(): 'plan' | 'members' | 'projects' | null;
    toggleSide(which: 'plan' | 'members' | 'projects'): void;
  }

  /** `draft`: un chat nuevo (sin `id` en la ruta y sin sesión). */
  function create(overrides: Record<string, unknown> = {}, draft = false): Page {
    const session = draft
      ? null
      : {
          id: 's1',
          title: 'Tarea',
          kind: 'task',
          groupIssueId: 'g1',
          notes: null,
          projectRepos: [],
          members: [],
          createdAt: '',
          ...overrides,
        };
    generate = vi.fn(() => Promise.resolve(true));
    removeAll = vi.fn(() => Promise.resolve(true));
    ask = vi.fn(() => Promise.resolve(true));
    chat = {
      messages: signal(messages),
      snapshot: vi.fn(() => chat.messages()),
      bind: vi.fn(),
      unbind: vi.fn(),
      clear: vi.fn(),
      sending: signal(false),
      onUpdatesPlan: null,
      provision: null,
    };
    toastError = vi.fn();
    router = {
      navigate: vi.fn(() => Promise.resolve(true)),
      navigateByUrl: vi.fn(() => Promise.resolve(true)),
    };
    const current = signal<Record<string, unknown> | null>(session);
    store = {
      current,
      sessions: signal([]),
      load: vi.fn(),
      create: vi.fn(() =>
        Promise.resolve({
          id: 'new1',
          title: 'Nueva conversación',
          kind: 'group',
          groupIssueId: 'gnew1',
          notes: null,
          projectRepos: [],
          members: [],
          createdAt: '',
        }),
      ),
      adopt: vi.fn((created: Record<string, unknown>) => current.set(created)),
      clearCurrent: vi.fn(() => current.set(null)),
      update: vi.fn(() => Promise.resolve(true)),
      setProjects: vi.fn(() => Promise.resolve(true)),
      setMembers: vi.fn(() => Promise.resolve(true)),
      addTicket: vi.fn(() => Promise.resolve(true)),
      remove: vi.fn(() => Promise.resolve(true)),
    };
    const fakes = [
      {
        provide: OrganizerStore,
        useValue: {
          ...store,
          error: signal(null),
          saving: signal(false),
          loading: signal(false),
          open: () => Promise.resolve(true),
        },
      },
      { provide: ProjectsApi, useValue: { list: () => of([]) } },
      { provide: AgentsStore, useValue: { load: vi.fn(), assistantOf: () => null } },
      { provide: IssuesStore, useValue: { load: vi.fn(), issueById: signal(new Map()) } },
      { provide: ConfirmDialog, useValue: { ask } },
      { provide: Toast, useValue: { success: vi.fn(), error: toastError } },
      { provide: Router, useValue: router },
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
              removeAll,
            },
          },
          { provide: TaskChatStore, useValue: chat },
          { provide: IssueExecutionsStore, useValue: { executions: signal([]), load: vi.fn() } },
        ],
      },
    });
    const fixture = TestBed.createComponent(OrganizerPage);
    lastFixture = fixture;
    if (!draft) fixture.componentRef.setInput('id', 's1');
    return fixture.componentInstance as unknown as Page;
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

  it('applies a change to the plan by itself when the AI understood the user asked for one', async () => {
    create();
    TestBed.tick();

    chat.onUpdatesPlan?.(false);
    TestBed.tick();
    await Promise.resolve();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith({ messages });
  });

  it('waits for the reply to finish before applying the change', async () => {
    create();
    chat.sending.set(true);
    TestBed.tick();

    chat.onUpdatesPlan?.(false);
    TestBed.tick();
    expect(generate).not.toHaveBeenCalled();

    chat.sending.set(false);
    TestBed.tick();
    await Promise.resolve();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('starts over: deletes the plans after asking, and keeps the conversation', async () => {
    const page = create();
    await page.createPlan();

    await page.reset();

    expect(ask).toHaveBeenCalledTimes(1);
    expect(removeAll).toHaveBeenCalledTimes(1);
    expect(chat.clear).not.toHaveBeenCalled();
    expect(chat.messages()).toHaveLength(3);
    // El plan nuevo se hace con toda la conversación, no solo con lo dicho después del último.
    await page.createPlan();
    expect(generate).toHaveBeenLastCalledWith({ messages });
  });

  it('does nothing if the user does not confirm, or if the plans could not be deleted', async () => {
    const page = create();
    await page.createPlan();

    ask.mockResolvedValueOnce(false);
    await page.reset();
    expect(removeAll).not.toHaveBeenCalled();

    removeAll.mockResolvedValueOnce(false);
    await page.reset();

    // Nada se borró: lo planificado sigue contando y la conversación no vuelve a viajar.
    await page.createPlan();
    expect(generate).toHaveBeenLastCalledWith({});
  });

  it('rebuilds from scratch with the whole conversation when the AI understood that was asked', async () => {
    const page = create();
    await page.createPlan();
    chat.messages.set([
      ...messages,
      say('assistant', 'Hecho'),
      say('user', 'Mejor rehazlo de cero'),
    ]);
    TestBed.tick();

    chat.onUpdatesPlan?.(true);
    TestBed.tick();
    await Promise.resolve();

    expect(generate).toHaveBeenLastCalledWith({
      messages: chat.messages(),
      fromScratch: true,
    });
  });

  describe('what opens beside the chat', () => {
    it('starts with only the chat, and a chip opens the plan or the tickets in its place', () => {
      const page = create();

      expect(page.side()).toBeNull();
      page.toggleSide('plan');
      expect(page.side()).toBe('plan');
      page.toggleSide('members');
      expect(page.side()).toBe('members');
    });

    it('closes what is open when its chip is pressed again', () => {
      const page = create();

      page.toggleSide('plan');
      page.toggleSide('plan');

      expect(page.side()).toBeNull();
    });
  });

  describe('a conversation without tickets or projects', () => {
    const fresh = { kind: 'group', title: 'Nueva conversación' };

    beforeEach(() => {
      messages = [];
    });

    it('names itself after the first message, once', () => {
      create(fresh);
      TestBed.tick();
      expect(store.update).not.toHaveBeenCalled();

      chat.messages.set([say('user', '  Arreglar   el login  \ny el logout')]);
      TestBed.tick();

      expect(store.update).toHaveBeenCalledWith('s1', { title: 'Arreglar el login' });
    });

    it('does not rename a conversation that already has its own title', () => {
      create({ kind: 'group', title: 'Anulación de guías' });
      chat.messages.set([say('user', 'Hola')]);
      TestBed.tick();

      expect(store.update).not.toHaveBeenCalled();
    });

    it('can ask for a plan as soon as something was said, even with no tickets', () => {
      const page = create(fresh);
      TestBed.tick();
      expect(page.canPlan()).toBe(false);

      chat.messages.set([say('user', 'Quiero agregar un filtro')]);
      TestBed.tick();

      expect(page.canPlan()).toBe(true);
    });

    it('adds and removes projects', async () => {
      const page = create(fresh);

      await page.changeProjects(['acme/web', 'acme/api']);
      await page.changeProjects([]);

      expect(store.setProjects).toHaveBeenNthCalledWith(1, 's1', ['acme/web', 'acme/api']);
      expect(store.setProjects).toHaveBeenNthCalledWith(2, 's1', []);
    });

    it('refuses more than three projects', async () => {
      const page = create(fresh);

      await page.changeProjects(['a/1', 'a/2', 'a/3', 'a/4']);

      expect(store.setProjects).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalled();
    });
  });

  describe('a new chat (no id in the route)', () => {
    beforeEach(() => {
      messages = [];
    });

    it('creates nothing just by opening it', () => {
      const page = create({}, true);
      TestBed.tick();

      expect(page.isDraft()).toBe(true);
      expect(page.view()?.title).toBe('Nueva conversación');
      expect(store.create).not.toHaveBeenCalled();
      expect(page.canPlan()).toBe(false);
    });

    it('keeps the projects chosen in the new chat until it is created', async () => {
      const page = create({}, true);

      await page.changeProjects(['acme/web']);

      expect(page.view()?.projectRepos).toEqual(['acme/web']);
      expect(store.setProjects).not.toHaveBeenCalled();
      expect(store.create).not.toHaveBeenCalled();
    });

    it('is created with the first message, with those projects, and moves the route to it without stacking history', async () => {
      const page = create({}, true);
      await page.changeProjects(['acme/web']);

      const key = await chat.provision?.();

      expect(key).toBe('gnew1');
      expect(store.create).toHaveBeenCalledWith({ projectRepos: ['acme/web'] });
      expect(store.adopt).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith(['/organizer', 'new1'], { replaceUrl: true });
      expect(page.isDraft()).toBe(false);
    });

    it('is created with nothing when no project was chosen', async () => {
      create({}, true);

      await chat.provision?.();

      expect(store.create).toHaveBeenCalledWith({});
    });

    it('creates one conversation even if two things ask for it at once', async () => {
      create({}, true);

      await Promise.all([chat.provision?.(), chat.provision?.()]);

      expect(store.create).toHaveBeenCalledTimes(1);
    });

    it('stays new when it could not be created', async () => {
      const page = create({}, true);
      store.create.mockResolvedValueOnce(null);

      expect(await chat.provision?.()).toBeNull();

      expect(page.isDraft()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('creates the conversation when a ticket is added to it', async () => {
      const page = create({}, true);

      await page.createTicket('Primero');

      expect(store.create).toHaveBeenCalledTimes(1);
      expect(store.addTicket).toHaveBeenCalledWith('new1', 'Primero');
    });

    it('goes back to an empty chat when the route loses its id', () => {
      create({ kind: 'group', title: 'Algo' });
      TestBed.tick();

      lastFixture.componentRef.setInput('id', undefined);
      TestBed.tick();

      expect(store.clearCurrent).toHaveBeenCalled();
      expect(chat.unbind).toHaveBeenCalled();
    });
  });
});
