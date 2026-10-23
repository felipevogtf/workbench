import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Toast } from '@shared/ui/toast/toast';
import { PlansStore } from '../../data-access/plans.store';
import { TaskChatStore } from '../../data-access/task-chat.store';
import { TasksApi } from '../../data-access/tasks.api';
import { Issue } from '../../models/issue';
import { Plan, PlanStatus } from '../../models/plan';
import { TaskChat } from './task-chat';

const plan = (id: string, status: PlanStatus): Plan => ({
  id,
  issueId: 'i1',
  status,
  agentName: 'default-planner',
  model: 'm',
  repos: [],
  revised: false,
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const issue = { id: 'i1', name: 'Vista de órdenes' } as Issue;

describe('TaskChat', () => {
  let api: Record<'listPlans' | 'getPlan' | 'createPlan' | 'chatTask', ReturnType<typeof vi.fn>>;
  let chat: TaskChatStore;
  let plans: PlansStore;
  let toast: Toast;

  beforeEach(async () => {
    localStorage.clear();
    api = {
      listPlans: vi.fn(() => of([plan('p1', 'ready')])),
      getPlan: vi.fn(() => of({ ...plan('p1', 'ready'), content: '# plan' })),
      createPlan: vi.fn(() => of({ ...plan('p2', 'pending'), revised: true })),
      chatTask: vi.fn(() =>
        of({
          reply: 'Cambiaría el paso 2.',
          agentName: 'a',
          model: 'm',
          tickets: [],
          hasPlan: true,
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [PlansStore, TaskChatStore, { provide: TasksApi, useValue: api }],
    });
    chat = TestBed.inject(TaskChatStore);
    plans = TestBed.inject(PlansStore);
    toast = TestBed.inject(Toast);
    vi.spyOn(toast, 'success');
    await plans.load('i1');
  });

  afterEach(() => plans.stopPolling());

  async function render(): Promise<HTMLElement> {
    chat.toggle();
    const fixture = TestBed.createComponent(TaskChat);
    fixture.componentRef.setInput('issue', issue);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));
  const replanButton = (element: HTMLElement) =>
    element.querySelector<HTMLButtonElement>('.panel__actions button')!;

  it('opens the conversation of the task and says which plan the AI has in view', async () => {
    const element = await render();

    expect(element.querySelector('.panel__context')?.textContent).toContain('Vista de órdenes');
    expect(element.querySelector('.info')?.textContent).toContain('Con el plan de');
    expect(element.querySelector('.panel__empty')?.textContent).toContain('Replanificar');
  });

  it('says there is no plan yet when the task has none', async () => {
    api.listPlans.mockReturnValue(of([]));
    await plans.load('i1');

    const element = await render();

    expect(element.querySelector('.info')?.textContent).toContain('Todavía sin plan');
  });

  it('cannot replan until the user has said something', async () => {
    const element = await render();
    expect(replanButton(element).disabled).toBe(true);

    await chat.send('Corrige el paso 2');
    await settle();

    expect(replanButton(element).disabled).toBe(false);
  });

  it('cannot replan while another plan is being generated', async () => {
    api.listPlans.mockReturnValue(of([plan('p1', 'ready'), plan('p0', 'generating')]));
    await plans.load('i1');
    const element = await render();

    await chat.send('Corrige el paso 2');
    await settle();

    expect(replanButton(element).disabled).toBe(true);
  });

  it('replans with the conversation, then starts a clean one and closes the panel', async () => {
    const element = await render();
    await chat.send('Corrige el paso 2');
    await settle();

    replanButton(element).click();
    await settle();
    await settle();

    expect(api.createPlan).toHaveBeenCalledWith('i1', {
      messages: [
        { role: 'user', content: 'Corrige el paso 2' },
        { role: 'assistant', content: 'Cambiaría el paso 2.' },
      ],
    });
    expect(chat.messages()).toEqual([]);
    expect(chat.open()).toBe(false);
    expect(toast.success).toHaveBeenCalled();
    expect(plans.plans()[0].revised).toBe(true);
  });

  it('keeps the conversation when the replan could not be requested', async () => {
    api.createPlan.mockReturnValue(throwError(() => new Error('boom')));
    const element = await render();
    await chat.send('Corrige el paso 2');
    await settle();

    replanButton(element).click();
    await settle();
    await settle();

    expect(chat.messages()).toHaveLength(2);
    expect(chat.open()).toBe(true);
  });
});
