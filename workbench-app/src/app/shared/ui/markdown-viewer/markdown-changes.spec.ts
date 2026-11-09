import { renderMarkdown } from './markdown-changes';

const PLAN = [
  '## Objetivo',
  '',
  'Crear el endpoint.',
  '',
  '## Pasos',
  '',
  '1. Migración',
  '2. Servicio',
  '3. Pruebas',
].join('\n');

function render(current: string, previous?: string | null): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderMarkdown(current, { breaks: false, previous });
  return host;
}

describe('renderMarkdown', () => {
  it('marks nothing without a previous version', () => {
    expect(render(PLAN).querySelector('.md-changed')).toBeNull();
    expect(render(PLAN, null).querySelector('.md-changed')).toBeNull();
  });

  it('marks nothing when the text did not change', () => {
    expect(render(PLAN, PLAN).querySelector('.md-changed')).toBeNull();
  });

  it('marks only the list item that changed, not its neighbours', () => {
    const edited = PLAN.replace('2. Servicio', '2. Servicio y controlador');

    const changed = [...render(edited, PLAN).querySelectorAll('.md-changed')];

    expect(changed.map((element) => element.textContent?.trim())).toEqual([
      '2. Servicio y controlador'.replace(/^\d\. /, ''),
    ]);
  });

  it('marks an added line and a rewritten paragraph', () => {
    const edited =
      PLAN.replace('Crear el endpoint.', 'Crear y probar el endpoint.') + '\n4. Documentación';

    const changed = [...render(edited, PLAN).querySelectorAll('.md-changed')].map((element) =>
      element.textContent?.trim(),
    );

    expect(changed).toContain('Crear y probar el endpoint.');
    expect(changed).toContain('Documentación');
    expect(changed).not.toContain('Migración');
  });

  it('keeps rendering the markdown as usual when it marks', () => {
    const host = render(PLAN.replace('## Pasos', '## Pasos a seguir'), PLAN);

    expect(host.querySelector('h2.md-changed, .md-changed h2')?.textContent).toBe('Pasos a seguir');
    expect(host.querySelectorAll('li')).toHaveLength(3);
  });
});
