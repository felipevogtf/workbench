import { TestBed } from '@angular/core/testing';
import { ActivityEvent } from '../../models/activity';
import { BoardCard, JobSummary } from '../../models/execution';
import { boardCard, job, ticket } from '../../testing/factories';
import { TicketPanel } from './ticket-panel';

describe('TicketPanel', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(TicketPanel);
    fixture.componentRef.setInput('title', 'Incorporar tipografía');
    fixture.componentRef.setInput('jobs', []);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    return fixture;
  }

  const card: BoardCard = boardCard(
    ticket('a', {
      description: 'Instalar `@fontsource` en el proyecto',
      criteria: ['Compila sin errores', 'No hay Roboto'],
      status: 'reviewing',
      feedback: ['Falta el lockfile'],
      summary: 'Agregué la fuente',
      reviewNote: 'Casi listo',
      startSha: 'aaaaaaaa1111',
      headSha: 'bbbbbbbb2222',
    }),
    { worker: { name: 'Maine', avatar: null } },
  );

  const tabs = (element: HTMLElement) =>
    [...element.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
  const click = (element: HTMLElement, label: string) =>
    (
      [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((t) =>
        t.textContent?.includes(label),
      ) as HTMLButtonElement
    ).click();

  it('opens on the detail of the ticket, with who has it', async () => {
    const fixture = await render({ card });
    const element: HTMLElement = fixture.nativeElement;

    expect(tabs(element)).toEqual(['Detalle', 'Actividad', 'Registro']);
    expect(element.querySelector('.panel__sub')?.textContent).toContain('En revisión');
    expect(element.querySelector('.panel__worker')?.textContent).toContain('Asignado a Maine');
    expect(element.textContent).toContain('Compila sin errores');
    expect(element.textContent).toContain('Falta el lockfile');
    expect(element.textContent).toContain('Agregué la fuente');
    expect(element.textContent).toContain('Casi listo');
  });

  it('renders the description as markdown', async () => {
    const element: HTMLElement = (await render({ card })).nativeElement;

    expect(element.querySelector('app-markdown-viewer code')?.textContent).toBe('@fontsource');
  });

  it('shows the branch and the commits of the ticket', async () => {
    const element: HTMLElement = (await render({ card, branch: 'workbench/hu-1-abc' }))
      .nativeElement;

    expect(element.textContent).toContain('workbench/hu-1-abc');
    expect(element.textContent).toContain('aaaaaaaa → bbbbbbbb');
  });

  it('says it will be taken by the one that is up next', async () => {
    const waiting = boardCard(ticket('a'), {
      worker: { name: 'David', avatar: null },
      upcoming: true,
    });
    const element: HTMLElement = (await render({ card: waiting })).nativeElement;

    expect(element.querySelector('.panel__worker')?.textContent).toContain('Irá con David');
  });

  it('tells the story in the activity tab', async () => {
    const events: ActivityEvent[] = [
      {
        at: '2026-10-25T10:00:00Z',
        who: 'David',
        action: 'empezó el desarrollo',
        detail: null,
        tone: 'neutral',
      },
      {
        at: '2026-10-25T10:08:00Z',
        who: 'Maine',
        action: 'pidió cambios',
        detail: '- Falta el lockfile',
        tone: 'warning',
      },
    ];
    const fixture = await render({ card, events });
    const element: HTMLElement = fixture.nativeElement;

    click(element, 'Actividad');
    await fixture.whenStable();

    const items = [...element.querySelectorAll('.event')];
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('David empezó el desarrollo');
    expect(items[1].getAttribute('data-tone')).toBe('warning');
    expect(items[1].textContent).toContain('Falta el lockfile');
  });

  it('says nothing has happened yet when there is no activity', async () => {
    const fixture = await render({ card });
    click(fixture.nativeElement, 'Actividad');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Todavía no ha pasado nada');
  });

  describe('the log tab', () => {
    const jobs: JobSummary[] = [
      job('j1', { kind: 'develop', agentId: 'dev', attempt: 1 }),
      job('j2', {
        kind: 'develop',
        agentId: 'dev',
        attempt: 2,
        status: 'failed',
        error: 'Sin permiso',
      }),
    ];
    const workerName = (id: string | null) => (id === 'dev' ? 'David' : '');

    it('lists the jobs with their worker and attempt, and shows the log of the picked one', async () => {
      const fixture = await render({
        card,
        jobs,
        workerName,
        selectedJobId: 'j2',
        logs: 'Instalando…',
      });
      const element: HTMLElement = fixture.nativeElement;
      click(element, 'Registro');
      await fixture.whenStable();

      const chips = [...element.querySelectorAll('.job')].map((j) =>
        j.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(chips[0]).toContain('Desarrollo · David');
      expect(chips[1]).toContain('Desarrollo · David (intento 2)');
      expect(element.querySelector('.logs')?.textContent).toBe('Instalando…');
      expect(element.textContent).toContain('Sin permiso');
    });

    it('asks to pick another job when one is chosen', async () => {
      const fixture = await render({ card, jobs, workerName, selectedJobId: 'j2' });
      const picked: string[] = [];
      fixture.componentInstance.selectJob.subscribe((id) => picked.push(id));
      click(fixture.nativeElement, 'Registro');
      await fixture.whenStable();

      (fixture.nativeElement.querySelector('.job') as HTMLButtonElement).click();

      expect(picked).toEqual(['j1']);
    });

    it('says the log shows up when a runner takes a queued job', async () => {
      const fixture = await render({
        card,
        jobs: [job('q', { status: 'pending' })],
        selectedJobId: 'q',
      });
      click(fixture.nativeElement, 'Registro');
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('cuando un runner lo tome');
    });
  });

  describe('as the general log', () => {
    it('has no ticket, so only the log tab', async () => {
      const fixture = await render({
        card: null,
        title: 'Registro general',
        jobs: [job('t', { kind: 'tickets' })],
      });
      const element: HTMLElement = fixture.nativeElement;

      expect(tabs(element)).toEqual(['Registro']);
      expect(element.querySelector('.panel__sub')).toBeNull();
      expect(element.querySelector('.job')).not.toBeNull();
    });
  });

  it('closes from the button, the backdrop and Escape', async () => {
    const fixture = await render({ card });
    let closed = 0;
    fixture.componentInstance.dismissed.subscribe(() => closed++);
    const element: HTMLElement = fixture.nativeElement;

    (element.querySelector('.panel__head button') as HTMLButtonElement).click();
    (element.querySelector('.backdrop') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toBe(3);
  });
});
