import { TestBed } from '@angular/core/testing';
import { boardCard, ticket } from '../../testing/factories';
import { TicketQuestions } from './ticket-questions';

const question = (extra: Partial<NonNullable<ReturnType<typeof ticket>['question']>> = {}) => ({
  id: 'q1',
  from: 'David',
  agentId: 'ag-dev',
  text: '¿El banner va en todas las pantallas del AST o solo en el formulario?',
  recommendation: null,
  askedAt: '2026-10-26T00:00:00Z',
  ...extra,
});

async function render(recommendation: string | null = null, inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(TicketQuestions);
  fixture.componentRef.setInput('cards', [
    boardCard(
      ticket('a', {
        title: 'Banner de conexión',
        status: 'waiting',
        question: question({ recommendation }),
      }),
      { number: 2 },
    ),
  ]);
  fixture.componentRef.setInput('lucy', { name: 'Lucy', avatar: null });
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  return fixture;
}

describe('TicketQuestions', () => {
  it('says who asks, in which ticket, and what', async () => {
    const element: HTMLElement = (await render()).nativeElement;

    expect(element.textContent).toContain('Lucy necesita tu respuesta');
    expect(element.textContent).toContain('David');
    expect(element.textContent).toContain('ticket 2');
    expect(element.textContent).toContain('Banner de conexión');
    expect(element.querySelector('blockquote')?.textContent).toContain(
      '¿El banner va en todas las pantallas',
    );
    expect(element.querySelector('app-avatar')).not.toBeNull();
  });

  it('shows the recommendation of Lucy, or says she is still thinking', async () => {
    const thinking: HTMLElement = (await render(null)).nativeElement;
    expect(thinking.textContent).toContain('está pensando qué recomendar');
    expect(thinking.textContent).not.toContain('Usar la recomendación');

    const advised: HTMLElement = (await render('Recomiendo todas las pantallas.')).nativeElement;
    expect(advised.textContent).toContain('Recomiendo todas las pantallas.');
    expect(advised.textContent).toContain('Usar la recomendación');
  });

  it('answers with what the user wrote', async () => {
    const fixture = await render();
    const emitted: unknown[] = [];
    fixture.componentInstance.answer.subscribe((reply) => emitted.push(reply));
    const box = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    box.value = '  Solo en el formulario.  ';
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );

    expect(emitted).toEqual([{ ticketId: 'a', text: 'Solo en el formulario.' }]);
    expect(box.value).toBe('');
  });

  it('does not send an empty answer', async () => {
    const fixture = await render();
    const emitted: unknown[] = [];
    fixture.componentInstance.answer.subscribe((reply) => emitted.push(reply));
    const box = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

    box.value = '   ';
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );

    expect(emitted).toEqual([]);
  });

  it('accepts the recommendation as the answer', async () => {
    const fixture = await render('Recomiendo todas las pantallas.');
    const emitted: unknown[] = [];
    fixture.componentInstance.answer.subscribe((reply) => emitted.push(reply));

    const accept = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      (button as HTMLElement).textContent?.includes('Usar la recomendación'),
    ) as HTMLButtonElement;
    accept.click();

    expect(emitted).toEqual([{ ticketId: 'a', text: 'Recomiendo todas las pantallas.' }]);
  });

  it('locks the form while an answer is being sent', async () => {
    const fixture = await render(null, { busy: true });

    expect((fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(
      true,
    );
  });
});
