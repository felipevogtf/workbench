import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { OrganizerStore } from '../../data-access/organizer.store';
import { OrganizerNewPage } from './organizer-new-page';

describe('OrganizerNewPage', () => {
  let create: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  function render(created: { id: string } | null) {
    create = vi.fn(() => Promise.resolve(created));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: OrganizerStore, useValue: { create } }],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    return TestBed.createComponent(OrganizerNewPage);
  }

  it('creates an empty conversation, asking for nothing, and opens it replacing the route', async () => {
    const fixture = render({ id: 's1' });
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith();
    expect(navigate).toHaveBeenCalledWith(['/organizer', 's1'], { replaceUrl: true });
  });

  it('says so when it could not be created, and does not navigate', async () => {
    const fixture = render(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No se pudo crear la conversación',
    );
  });
});
