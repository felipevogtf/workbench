import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectsApi } from '@projects/index';
import { TaskProjectsStore } from '../../data-access/task-projects.store';
import { TaskProject } from '../../models/catalogs';
import { ProjectSettingsDialog } from './project-settings-dialog';

const plane: TaskProject = {
  id: 'tp1',
  name: 'Melón',
  externalId: 'e1',
  source: 'plane',
  identifier: 'MEL',
  ticketBaseUrl: null,
  syncEnabled: true,
  visible: true,
  defaultProjectRepos: ['acme/web'],
  syncedAt: null,
  createdAt: '2026-11-19T00:00:00Z',
};

@Component({
  imports: [ProjectSettingsDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-project-settings-dialog [(open)]="open" [project]="project()" />`,
})
class Host {
  open = signal(false);
  project = signal<TaskProject | null>(plane);
}

describe('ProjectSettingsDialog: default projects', () => {
  const configure = vi.fn(() => Promise.resolve(plane));

  beforeEach(() => {
    configure.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskProjectsStore, useValue: { configure } },
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
    const chip = (label: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('app-chip-picker button')].find((button) =>
        button.textContent?.includes(label),
      )!;
    const submit = () => {
      root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      return fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, chip, submit };
  }

  it('starts with the default projects the task project already has', async () => {
    const { chip } = await render();

    expect(chip('Web').getAttribute('aria-pressed')).toBe('true');
    expect(chip('API').getAttribute('aria-pressed')).toBe('false');
  });

  it('saves the chosen default projects', async () => {
    const { fixture, chip, submit, host } = await render();

    chip('API').click();
    chip('Web').click();
    await fixture.whenStable();
    await submit();

    expect(configure).toHaveBeenCalledWith(
      'tp1',
      expect.objectContaining({ defaultProjectRepos: ['acme/api'] }),
    );
    expect(host.open()).toBe(false);
  });
});
