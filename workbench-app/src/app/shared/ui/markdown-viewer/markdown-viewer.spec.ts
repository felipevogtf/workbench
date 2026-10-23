import { TestBed } from '@angular/core/testing';
import { MarkdownViewer } from './markdown-viewer';

describe('MarkdownViewer', () => {
  async function render(content: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(MarkdownViewer);
    fixture.componentRef.setInput('content', content);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders markdown', async () => {
    const element = await render('## Resumen\n\nTexto con `código`.');

    expect(element.querySelector('h2')?.textContent).toBe('Resumen');
    expect(element.querySelector('code')?.textContent).toBe('código');
  });

  it('joins single line breaks, like Markdown, unless asked to keep them', async () => {
    const joined = await render('línea uno\nlínea dos');
    expect(joined.querySelector('br')).toBeNull();

    const fixture = TestBed.createComponent(MarkdownViewer);
    fixture.componentRef.setInput('content', 'línea uno\nlínea dos');
    fixture.componentRef.setInput('breaks', true);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('br')).not.toBeNull();
  });

  it('never lets scripts or event handlers through', async () => {
    const element = await render(
      'Hola <script>window.pwned = true</script> <img src=x onerror="window.pwned = true">',
    );

    expect(element.querySelector('script')).toBeNull();
    expect(element.innerHTML).not.toContain('onerror');
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined();
  });

  it('opens links in a new tab without access to the opener', async () => {
    const element = await render('[docs](https://example.test)');
    const link = element.querySelector('a');

    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });
});
