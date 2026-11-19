import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectsApi } from '@projects/index';
import { TaskProjectsStore } from '@tasks/index';
import { OrganizerStore } from '../../data-access/organizer.store';
import { NewOrganizerSession, OrganizerSession } from '../../models/organizer';
import { SessionFormDialog } from './session-form-dialog';

const session: OrganizerSession = {
  id: 's1',
  title: 'Sesión',
  kind: 'group',
  groupIssueId: 'g1',
  notes: null,
  projectRepos: ['acme/web'],
  members: [],
  createdAt: '2026-11-19T00:00:00Z',
};

@Component({
  imports: [SessionFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-session-form-dialog [(open)]="open" (created)="created.set($event)" />`,
})
class Host {
  open = signal(false);
  created = signal<OrganizerSession | null>(null);
}

describe('SessionFormDialog', () => {
  let create: ReturnType<typeof vi.fn<(input: NewOrganizerSession) => Promise<OrganizerSession | null>>>;

  beforeEach(() => {
    create = vi.fn(() => Promise.resolve(session));
    TestBed.configureTestingModule({
      providers: [
        { provide: OrganizerStore, useValue: { create, saving: () => false } },
        {
          provide: ProjectsApi,
          useValue: {
            list: () =>
              of([
                { repo: 'acme/web', name: 'Web' },
                { repo: 'acme/api', name: 'API' },
              ]),
          },
        },
        {
          provide: TaskProjectsStore,
          useValue: { load: () => Promise.resolve(), projects: () => [{ id: 'tp1', name: 'Melón' }] },
        },
      ],
    });
  });

  async function render() {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const type = (id: string, value: string) => {
      const element = root.querySelector<HTMLInputElement>(`#${id}`)!;
      element.value = value;
      element.dispatchEvent(new Event('input'));
    };
    const pick = async (label: string) => {
      [...root.querySelectorAll<HTMLButtonElement>('app-chip-picker button')]
        .find((button) => button.textContent?.includes(label))!
        .click();
      await fixture.whenStable();
    };
    const submit = () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      return fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, root, type, pick, submit };
  }

  it('creates a free session from the projects it works on, with no task project', async () => {
    const { host, type, pick, submit } = await render();

    type('session-title', '  Arreglar el login  ');
    await pick('Web');
    await submit();

    expect(create).toHaveBeenCalledWith({ title: 'Arreglar el login', projectRepos: ['acme/web'] });
    expect(host.created()).toEqual(session);
    expect(host.open()).toBe(false);
  });

  it('does not create a session that has nowhere to live', async () => {
    const { type, submit, root } = await render();

    type('session-title', 'Sin lugar');
    await submit();

    expect(create).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Elige al menos un proyecto');
  });

  it('does not create it without a title', async () => {
    const { pick, submit } = await render();

    await pick('API');
    await submit();

    expect(create).not.toHaveBeenCalled();
  });
});
