import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { IssuesStore } from '../../data-access/issues.store';
import { LabelsStore } from '../../data-access/labels.store';
import { PlansStore } from '../../data-access/plans.store';
import { ProjectsStore } from '../../data-access/projects.store';
import { StatesStore } from '../../data-access/states.store';
import { TasksApi } from '../../data-access/tasks.api';
import { Issue } from '../../models/issue';
import { IssueDetailPage } from './issue-detail-page';

const issue: Issue = {
  id: 'i1',
  name: 'Corregir el login',
  isLocal: true,
  externalId: null,
  remoteSequence: null,
  localSequence: 7,
  externalState: null,
  description: 'Falla con tildes',
  priority: 'high',
  estimatedHours: 4,
  stateId: 's1',
  projectId: 'p1',
  labelIds: [],
  startDate: null,
  dueDate: null,
  closedAt: null,
};

describe('IssueDetailPage', () => {
  function stub(values: Record<string, unknown> = {}) {
    return { load: () => Promise.resolve(), ...values };
  }

  async function render(current: Issue = issue) {
    const close = vi.fn(() => Promise.resolve(true));
    const reopen = vi.fn(() => Promise.resolve(true));
    const tasksApi = {
      listTimeEntries: () => of([]),
      listPlans: () => of([]),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TasksApi, useValue: tasksApi },
        {
          provide: IssuesStore,
          useValue: stub({
            issueById: signal(new Map([[current.id, current]])),
            issues: signal([]),
            close,
            reopen,
          }),
        },
        {
          provide: ProjectsStore,
          useValue: stub({ projectById: signal(new Map()), projects: signal([]) }),
        },
        {
          provide: StatesStore,
          useValue: stub({
            states: signal([
              { id: 's1', name: 'En curso', color: null, position: 0, isFinal: false },
            ]),
            stateById: signal(new Map()),
          }),
        },
        {
          provide: LabelsStore,
          useValue: stub({ labelById: signal(new Map()), labels: signal([]) }),
        },
        {
          provide: PlansStore,
          useValue: stub({
            plans: signal([]),
            requesting: signal(false),
            active: signal(null),
          }),
        },
      ],
    });
    const fixture = TestBed.createComponent(IssueDetailPage);
    fixture.componentRef.setInput('id', current.id);
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, close, reopen };
  }

  it('shows the task, its description and the hours panel', async () => {
    const { root } = await render();

    const text = root.textContent ?? '';
    expect(text).toContain('Corregir el login');
    expect(text).toContain('Falla con tildes');
    expect(root.querySelector('app-hours-panel')).not.toBeNull();
  });

  it('offers to close an open task', async () => {
    const { root } = await render();

    expect(root.textContent).toContain('Cerrar tarea');
  });

  it('offers to reopen a closed task', async () => {
    const { root } = await render({ ...issue, closedAt: '2026-10-05T12:00:00Z' });

    expect(root.textContent).toContain('Reabrir');
  });

  it('offers to transfer only local tasks', async () => {
    const local = await render();
    expect(local.root.textContent).toContain('Transferir');

    TestBed.resetTestingModule();
    const remote = await render({ ...issue, isLocal: false, externalId: 'x', remoteSequence: 3 });
    expect(remote.root.textContent).not.toContain('Transferir');
  });
});
