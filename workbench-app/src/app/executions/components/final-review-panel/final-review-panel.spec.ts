import { TestBed } from '@angular/core/testing';
import { FinalReview, FinalReviewFinding } from '../../models/execution';
import { FinalReviewPanel } from './final-review-panel';

const finding = (extra: Partial<FinalReviewFinding> = {}): FinalReviewFinding => ({
  severity: 'high',
  file: 'docker/nginx/dsy.conf',
  issue: 'La ruta /ea no existe',
  suggestion: 'Usar `/secured/admin/ea`',
  ...extra,
});

const review = (extra: Partial<FinalReview> = {}): FinalReview => ({
  status: 'done',
  requestedAt: '2026-10-26T10:00:00Z',
  finishedAt: '2026-10-26T10:05:00Z',
  summary: 'Falta cubrir una parte del plan',
  findings: [finding()],
  error: null,
  ...extra,
});

describe('FinalReviewPanel', () => {
  async function render(inputs: {
    review?: FinalReview | null;
    completed?: boolean;
    busy?: boolean;
  }) {
    const fixture = TestBed.createComponent(FinalReviewPanel);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
        b.textContent?.includes(text),
      );
    return { fixture, element, button };
  }

  it('explains what the review is and offers it when it was never asked', async () => {
    const { element, button } = await render({ review: null, completed: true });

    expect(element.textContent).toContain('Un revisor lee toda la rama');
    expect(button('Pedir la revisión final')).toBeDefined();
  });

  it('asks for the review when the user presses the button', async () => {
    const { fixture, button } = await render({ review: null, completed: true });
    const requested: unknown[] = [];
    fixture.componentInstance.requested.subscribe(() => requested.push(true));

    button('Pedir la revisión final')!.click();

    expect(requested).toHaveLength(1);
  });

  it('does not offer it before the execution is completed', async () => {
    const { element, button } = await render({ review: null, completed: false });

    expect(button('Pedir la revisión final')).toBeUndefined();
    expect(element.textContent).toContain('Un revisor lee toda la rama');
  });

  it('shows that the reviewer is working, and does not offer to ask again meanwhile', async () => {
    const { element, button } = await render({
      review: review({ status: 'running', summary: null, findings: [], finishedAt: null }),
      completed: true,
    });

    expect(element.textContent).toContain('El revisor está leyendo la rama');
    expect(element.querySelector('app-spinner')).not.toBeNull();
    expect(button('Pedir')).toBeUndefined();
  });

  it('shows why it failed and lets the user ask again', async () => {
    const { element, button } = await render({
      review: review({ status: 'failed', error: 'el runner no respondió', findings: [] }),
      completed: true,
    });

    expect(element.textContent).toContain('La revisión final falló');
    expect(element.textContent).toContain('el runner no respondió');
    expect(button('Pedirla de nuevo')).toBeDefined();
  });

  it('shows the summary and each finding with its severity, file, problem and what to change', async () => {
    const { element } = await render({
      review: review({
        findings: [
          finding(),
          finding({ severity: 'low', file: null, issue: 'Un detalle', suggestion: '' }),
        ],
      }),
      completed: true,
    });

    expect(element.textContent).toContain('Falta cubrir una parte del plan');
    const items = [...element.querySelectorAll('.finding')];
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Alta');
    expect(items[0].querySelector('code')?.textContent).toBe('docker/nginx/dsy.conf');
    expect(items[0].textContent).toContain('La ruta /ea no existe');
    expect(items[0].querySelector('code + p code, .finding__suggestion code')?.textContent).toBe(
      '/secured/admin/ea',
    );
    expect(items[1].textContent).toContain('Baja');
    expect(items[1].querySelector('.finding__file')).toBeNull();
    expect(items[1].querySelector('.finding__suggestion')).toBeNull();
  });

  it('says it found nothing when the report is empty', async () => {
    const { element } = await render({
      review: review({ findings: [], summary: 'Todo en orden' }),
      completed: true,
    });

    expect(element.textContent).toContain('Todo en orden');
    expect(element.textContent).toContain('No encontró problemas');
    expect(element.querySelector('.finding')).toBeNull();
  });

  it('turns a finding into a correction ticket when the user asks, only with the execution completed', async () => {
    const completed = await render({ review: review(), completed: true });
    const fixed: FinalReviewFinding[] = [];
    completed.fixture.componentInstance.fix.subscribe((each) => fixed.push(each));

    completed.button('Corregir con un ticket')!.click();

    expect(fixed).toEqual([finding()]);

    const running = await render({ review: review(), completed: false });
    expect(running.button('Corregir con un ticket')).toBeUndefined();
  });

  it('blocks the buttons while something is being saved', async () => {
    const { button } = await render({ review: review(), completed: true, busy: true });

    expect(button('Corregir con un ticket')!.disabled).toBe(true);
    expect(button('Pedirla de nuevo')!.disabled).toBe(true);
  });
});
