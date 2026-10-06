import { TestBed } from '@angular/core/testing';
import { TicketLink } from '../../models/pull-request';
import { TicketTags } from './ticket-tags';

describe('TicketTags', () => {
  async function render(tickets: TicketLink[]): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(TicketTags);
    fixture.componentRef.setInput('tickets', tickets);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows one link per ticket, opening Plane in another tab', async () => {
    const element = await render([
      { key: 'MEL-253', url: 'https://plane.test/ws/browse/MEL-253/' },
      { key: 'SER-10', url: 'https://plane.test/ws/browse/SER-10/' },
    ]);
    const links = Array.from(element.querySelectorAll('a'));

    expect(links.map((a) => a.textContent?.trim())).toEqual(['MEL-253', 'SER-10']);
    expect(links[0].getAttribute('href')).toBe('https://plane.test/ws/browse/MEL-253/');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toContain('noopener');
    expect(element.textContent).not.toContain('Sin ticket');
  });

  it('says "Sin ticket" when the pull request references none', async () => {
    const element = await render([]);

    expect(element.querySelectorAll('a')).toHaveLength(0);
    expect(element.textContent).toContain('Sin ticket');
  });
});
