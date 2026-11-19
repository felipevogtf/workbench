import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrganizerSessionSummary } from '../../models/organizer';
import { ConversationsSidebar } from './conversations-sidebar';

const summary = (id: string, title: string): OrganizerSessionSummary => ({
  id,
  title,
  kind: 'group',
  groupIssueId: `g-${id}`,
  memberCount: 0,
  createdAt: '2026-11-19T10:00:00Z',
});

describe('ConversationsSidebar', () => {
  function render(
    sessions: OrganizerSessionSummary[],
    activeId: string | null = null,
    loading = false,
  ) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ConversationsSidebar);
    fixture.componentRef.setInput('sessions', sessions);
    fixture.componentRef.setInput('activeId', activeId);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('always offers a new conversation first, which opens the organizer without an id', () => {
    const { root } = render([summary('a', 'Uno')]);

    const first = root.querySelector<HTMLAnchorElement>('nav a');
    expect(first?.textContent).toContain('Nueva conversación');
    expect(first?.getAttribute('href')).toBe('/organizer');
  });

  it('lists the conversations in the order it is given, each linking to its own address', () => {
    const { root } = render([summary('a', 'Login roto'), summary('b', 'Anulación de guías')]);

    const links = [...root.querySelectorAll<HTMLAnchorElement>('.side__link')];
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Login roto',
      'Anulación de guías',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/organizer/a',
      '/organizer/b',
    ]);
  });

  it('marks the open conversation, or the new chat when there is none', () => {
    const open = render([summary('a', 'Uno'), summary('b', 'Dos')], 'b').root;
    expect(open.querySelector('.side__item--active')?.textContent).toContain('Dos');
    expect(open.querySelector('.side__new--active')).toBeNull();
  });

  it('marks the new chat when no conversation is open', () => {
    TestBed.resetTestingModule();
    const { root } = render([summary('a', 'Uno')], null);

    expect(root.querySelector('.side__new--active')).not.toBeNull();
    expect(root.querySelector('.side__item--active')).toBeNull();
  });

  it('says so when there are no conversations yet', () => {
    const { root } = render([]);

    expect(root.textContent).toContain('Todavía no hay conversaciones');
  });

  it('shows placeholders while the first load is in progress', () => {
    const { root } = render([], null, true);

    expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Todavía no hay conversaciones');
  });

  it('tells which conversation to delete from its menu', async () => {
    const { fixture, root } = render([summary('a', 'Uno')]);
    const removed: OrganizerSessionSummary[] = [];
    fixture.componentInstance.removed.subscribe((each) => removed.push(each));

    root.querySelector<HTMLButtonElement>('.menu__trigger')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    // El panel del menú vive en una capa aparte, fuera del componente.
    document.querySelector<HTMLButtonElement>('.menu__item')?.click();

    expect(removed.map((each) => each.id)).toEqual(['a']);
  });

  it('tells the page when a conversation was chosen, so a panel can close', () => {
    const { fixture, root } = render([summary('a', 'Uno')]);
    let chosen = 0;
    fixture.componentInstance.navigated.subscribe(() => chosen++);

    root.querySelector<HTMLAnchorElement>('.side__link')?.click();

    expect(chosen).toBe(1);
  });
});
