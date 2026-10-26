import { TestBed } from '@angular/core/testing';
import { boardCard, ticket } from '../../testing/factories';
import { BoardCard } from '../../models/execution';
import { TicketBoard } from './ticket-board';

describe('TicketBoard', () => {
  async function render(cards: BoardCard[], inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(TicketBoard);
    fixture.componentRef.setInput('cards', cards);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    return fixture;
  }

  const columns = (element: HTMLElement) =>
    Object.fromEntries(
      [...element.querySelectorAll('.column')].map((column) => [
        column.getAttribute('data-status'),
        [...column.querySelectorAll('.card__title')].map((title) =>
          title.textContent?.replace(/\s+/g, ' ').trim(),
        ),
      ]),
    );

  it('puts each ticket in the column of its status', async () => {
    const fixture = await render([
      boardCard(ticket('a', { title: 'Uno', status: 'done' }), { number: 1 }),
      boardCard(ticket('b', { title: 'Dos', status: 'reviewing' }), { number: 2 }),
      boardCard(ticket('c', { title: 'Tres', status: 'developing' }), { number: 3 }),
      boardCard(ticket('d', { title: 'Cuatro' }), { number: 4 }),
    ]);

    expect(columns(fixture.nativeElement)).toEqual({
      pending: ['4 Cuatro'],
      developing: ['3 Tres'],
      reviewing: ['2 Dos'],
      done: ['1 Uno'],
    });
  });

  it('only shows the failed column when something failed', async () => {
    const without = await render([boardCard(ticket('a'))]);
    expect(without.nativeElement.querySelector('[data-status="failed"]')).toBeNull();

    const failed = await render([boardCard(ticket('a', { status: 'failed' }))]);
    expect(failed.nativeElement.querySelector('[data-status="failed"] .card')).not.toBeNull();
  });

  it('shows who has each ticket, and who will take the ones that wait', async () => {
    const fixture = await render([
      boardCard(ticket('a', { status: 'developing' }), { worker: { name: 'David', avatar: null } }),
      boardCard(ticket('b'), { worker: { name: 'David', avatar: null }, upcoming: true }),
      boardCard(ticket('c', { status: 'failed' })),
    ]);

    const workers = [...fixture.nativeElement.querySelectorAll('.card__worker')].map((w) =>
      w.textContent.trim(),
    );
    expect(workers).toEqual(['Irá con David', 'David', 'Sin asignar']);
    expect(fixture.nativeElement.querySelectorAll('app-avatar')).toHaveLength(2);
  });

  it('shows that it is working only while the execution runs', async () => {
    const cards = [
      boardCard(ticket('a', { status: 'developing' })),
      boardCard(ticket('b', { status: 'done' })),
    ];

    const idle = await render(cards, { running: false });
    expect(idle.nativeElement.querySelector('app-spinner')).toBeNull();

    const running = await render(cards, { running: true });
    expect(running.nativeElement.querySelectorAll('app-spinner')).toHaveLength(1);
  });

  it('flags the tickets that were reviewed or sent back', async () => {
    const fixture = await render([
      boardCard(ticket('a', { status: 'developing', rounds: 1, feedback: ['Arregla esto'] })),
    ]);

    const flags = fixture.nativeElement.querySelector('.card__flags').textContent;
    expect(flags).toContain('1 revisión(es)');
    expect(flags).toContain('Cambios pedidos');
  });

  it('opens the ticket that is clicked and highlights the open one', async () => {
    const fixture = await render(
      [boardCard(ticket('a', { title: 'Uno' })), boardCard(ticket('b', { title: 'Dos' }))],
      {
        selectedId: 'b',
      },
    );
    const opened: string[] = [];
    fixture.componentInstance.open.subscribe((id) => opened.push(id));

    (fixture.nativeElement.querySelector('.card') as HTMLButtonElement).click();

    expect(opened).toEqual(['a']);
    expect(fixture.nativeElement.querySelectorAll('.card.is-selected')).toHaveLength(1);
  });
});
