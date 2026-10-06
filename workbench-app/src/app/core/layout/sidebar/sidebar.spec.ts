import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NavItem, isUnder, provideNavItem } from '@core/navigation/nav-item';
import { Sidebar } from './sidebar';

@Component({ template: '' })
class Blank {}

const GROUP: NavItem = {
  label: 'Tareas',
  icon: 'list-checks',
  order: 1,
  children: [
    { label: 'Todas', icon: 'list-checks', path: '/tasks/issues' },
    { label: 'Estados', icon: 'circle-dot', path: '/tasks/states' },
  ],
};
const LINK: NavItem = { label: 'Kanban', icon: 'kanban', order: 2, path: '/kanban' };

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'tasks/issues', component: Blank },
          { path: 'tasks/states', component: Blank },
          { path: 'kanban', component: Blank },
          { path: 'other', component: Blank },
        ]),
        provideNavItem(LINK),
        provideNavItem(GROUP),
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(Sidebar);
    fixture.detectChanges();
    return fixture;
  }

  const groupButton = (root: HTMLElement) =>
    root.querySelector<HTMLButtonElement>('button.nav-group')!;

  it('lists the entries by order, with the group as a button', () => {
    const root: HTMLElement = render().nativeElement;
    const labels = [...root.querySelectorAll('nav > ul > li > .nav-link')].map((el) =>
      el.textContent?.trim(),
    );
    expect(labels).toEqual(['Tareas', 'Kanban']);
    expect(groupButton(root).getAttribute('aria-expanded')).toBe('false');
  });

  it('opens and closes the group, and remembers it', () => {
    const fixture = render();
    const root: HTMLElement = fixture.nativeElement;

    groupButton(root).click();
    fixture.detectChanges();
    expect(groupButton(root).getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelectorAll('.nav-sub a')).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem('workbench.sidebar.open-groups')!)).toEqual(['Tareas']);

    groupButton(root).click();
    fixture.detectChanges();
    expect(root.querySelector('.nav-sub')).toBeNull();
  });

  it('opens by itself when the current route is inside the group', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tasks/states');

    const fixture = render();
    await fixture.whenStable();
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    expect(groupButton(root).getAttribute('aria-expanded')).toBe('true');
    expect(groupButton(root).classList).toContain('has-active');
    expect(root.querySelector('.nav-sub a.is-active')?.textContent).toContain('Estados');
  });

  it('keeps the group closed on routes outside of it', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/other');

    const fixture = render();
    await fixture.whenStable();

    expect(groupButton(fixture.nativeElement).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('isUnder', () => {
  it('matches the path, its children and ignores query and fragment', () => {
    expect(isUnder('/tasks/issues', '/tasks/issues')).toBe(true);
    expect(isUnder('/tasks/issues/abc?x=1#y', '/tasks/issues')).toBe(true);
    expect(isUnder('/tasks/issues-old', '/tasks/issues')).toBe(false);
    expect(isUnder('/kanban', '/tasks')).toBe(false);
  });
});
