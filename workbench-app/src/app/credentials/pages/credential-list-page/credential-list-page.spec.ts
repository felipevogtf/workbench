import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CredentialsApi } from '../../data-access/credentials.api';
import { CredentialGroup } from '../../models/credential';
import { CredentialListPage } from './credential-list-page';

const group = (id: string, name: string, category: string | null = null): CredentialGroup => ({
  id,
  name,
  category,
  items: [
    { id: `${id}-u`, key: 'usuario', sensitive: false, value: 'felipe' },
    { id: `${id}-p`, key: 'pass', sensitive: true, value: null },
  ],
  createdAt: '2026-10-06T12:00:00Z',
  updatedAt: '2026-10-06T12:00:00Z',
});

describe('CredentialListPage', () => {
  async function render(api: Partial<Record<'list', unknown>>) {
    TestBed.configureTestingModule({ providers: [{ provide: CredentialsApi, useValue: api }] });
    const fixture = TestBed.createComponent(CredentialListPage);
    await fixture.whenStable();
    return fixture;
  }

  const text = (fixture: { nativeElement: unknown }) =>
    ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  it('shows the plain values and hides the sensitive ones', async () => {
    const fixture = await render({ list: () => of([group('a', 'aws', 'Nube')]) });

    const content = text(fixture);
    expect(content).toContain('aws');
    expect(content).toContain('Nube');
    expect(content).toContain('felipe');
    expect(content).toContain('••••••••');
  });

  it('offers to create the first group when there are none', async () => {
    const fixture = await render({ list: () => of([]) });

    expect(text(fixture)).toContain('Todavía no hay credenciales');
  });

  it('filters by group name, category or key but never by value', async () => {
    const fixture = await render({
      list: () => of([group('a', 'aws', 'Nube'), group('b', 'github', 'Código')]),
    });
    const root = fixture.nativeElement as HTMLElement;
    const search = root.querySelector<HTMLInputElement>('#credential-search')!;
    const type = async (value: string) => {
      search.value = value;
      search.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };

    await type('git');
    expect(text(fixture)).toContain('github');
    expect(text(fixture)).not.toContain('aws');

    await type('codigo');
    expect(text(fixture)).toContain('github');

    await type('felipe');
    expect(text(fixture)).toContain('Sin resultados');
  });

  it('shows the error and lets the user retry', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('sin conexión')))
      .mockReturnValue(of([group('a', 'aws')]));
    const fixture = await render({ list });

    expect(text(fixture)).toContain('No se pudieron cargar las credenciales');

    const retry = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[alert-action]',
    )!;
    retry.click();
    await fixture.whenStable();

    expect(text(fixture)).toContain('aws');
  });
});
