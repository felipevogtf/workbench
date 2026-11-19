import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IssuesStore, TaskProjectsStore } from '@tasks/index';
import { OrganizerMember } from '../../models/organizer';
import { MembersPanel } from './members-panel';

@Component({
  imports: [MembersPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-members-panel
      [members]="members()"
      groupIssueId="g1"
      [projectRepos]="repos()"
      (ticketCreated)="tickets.push($event)"
    />
  `,
})
class Host {
  members = signal<OrganizerMember[]>([]);
  repos = signal<string[]>(['acme/web']);
  tickets: string[] = [];
}

describe('MembersPanel: free session', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: IssuesStore, useValue: { load: () => Promise.resolve(), issues: () => [] } },
        {
          provide: TaskProjectsStore,
          useValue: { load: () => Promise.resolve(), projectById: () => new Map() },
        },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const openAdd = async () => {
      root.querySelector<HTMLButtonElement>('.chips__add button')!.click();
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, root, openAdd };
  }

  it('shows the projects where the session works', async () => {
    const { root } = await render();

    expect(root.textContent).toContain('Proyectos: acme/web');
  });

  it('creates a local ticket with the name that was typed, once, and clears the field', async () => {
    const { fixture, host, root, openAdd } = await render();
    await openAdd();

    const input = root.querySelector<HTMLInputElement>('input[aria-label="Nombre de un ticket nuevo"]')!;
    input.value = '  Validar el formulario  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('.new-ticket button')!.click();
    await fixture.whenStable();

    expect(host.tickets).toEqual(['Validar el formulario']);
    expect(input.value).toBe('');
  });

  it('does not create a ticket without a name', async () => {
    const { fixture, host, root, openAdd } = await render();
    await openAdd();

    expect(root.querySelector<HTMLButtonElement>('.new-ticket button')!.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('.new-ticket button')!.click();
    await fixture.whenStable();

    expect(host.tickets).toEqual([]);
  });
});
