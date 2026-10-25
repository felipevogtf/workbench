import { TestBed } from '@angular/core/testing';
import { Agent } from '../../../ai-agents/models/agent';
import { boardCard, ticket } from '../../testing/factories';
import { TicketAssignment } from './ticket-assignment';

function worker(id: string, displayName: string, level: Agent['level'] = null): Agent {
  return {
    id,
    name: id,
    systemPrompt: 'x',
    module: 'task-developer',
    provider: 'claude',
    model: 'm',
    allowedTools: [],
    isDefault: false,
    displayName,
    avatar: null,
    level,
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
  };
}

const DEVELOPERS = [worker('rebecca', 'Rebecca', 'simple'), worker('david', 'David', 'complex')];
const REVIEWERS = [worker('maine', 'Maine'), worker('pilar', 'Pilar')];

async function render() {
  const fixture = TestBed.createComponent(TicketAssignment);
  fixture.componentRef.setInput('cards', [
    boardCard(
      ticket('a', {
        title: 'Cambiar el texto',
        level: 'simple',
        developerId: 'rebecca',
        reviewerId: 'maine',
      }),
      { number: 1 },
    ),
    boardCard(
      ticket('b', {
        title: 'Cola offline',
        level: 'complex',
        developerId: 'david',
        reviewerId: 'pilar',
      }),
      { number: 2 },
    ),
  ]);
  fixture.componentRef.setInput('developers', DEVELOPERS);
  fixture.componentRef.setInput('reviewers', REVIEWERS);
  await fixture.whenStable();
  return fixture;
}

describe('TicketAssignment', () => {
  it('shows each ticket with its level and who has it', async () => {
    const element: HTMLElement = (await render()).nativeElement;

    const rows = [...element.querySelectorAll('.row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Cambiar el texto');
    expect(rows[0].textContent).toContain('Simple');
    expect(rows[1].textContent).toContain('Complejo');

    const selected = (row: Element, label: string) =>
      (row.querySelector(`select[aria-label^="${label}"]`) as HTMLSelectElement).selectedOptions[0]
        .textContent;
    expect(selected(rows[0], 'Desarrollador')?.trim()).toBe('Rebecca · Simple');
    expect(selected(rows[1], 'Desarrollador')?.trim()).toBe('David · Complejo');
    expect(selected(rows[1], 'Revisor')?.trim()).toBe('Pilar');
  });

  it('tells which ticket gets which worker when the user picks another one', async () => {
    const fixture = await render();
    const emitted: unknown[] = [];
    fixture.componentInstance.assign.subscribe((change) => emitted.push(change));

    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Desarrollador del ticket 1"]',
    ) as HTMLSelectElement;
    select.value = 'david';
    select.dispatchEvent(new Event('change'));

    const reviewer = fixture.nativeElement.querySelector(
      'select[aria-label="Revisor del ticket 2"]',
    ) as HTMLSelectElement;
    reviewer.value = 'maine';
    reviewer.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([
      { ticketId: 'a', developerId: 'david' },
      { ticketId: 'b', reviewerId: 'maine' },
    ]);
  });

  it('does not tell anything when the same worker is picked again', async () => {
    const fixture = await render();
    const emitted: unknown[] = [];
    fixture.componentInstance.assign.subscribe((change) => emitted.push(change));

    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Desarrollador del ticket 1"]',
    ) as HTMLSelectElement;
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([]);
  });
});
