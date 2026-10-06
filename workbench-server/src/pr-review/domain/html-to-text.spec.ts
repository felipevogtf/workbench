import { htmlToText } from './html-to-text';

describe('htmlToText', () => {
  it('returns an empty string for missing html', () => {
    expect(htmlToText(null, 100)).toBe('');
    expect(htmlToText(undefined, 100)).toBe('');
    expect(htmlToText('', 100)).toBe('');
  });

  it('keeps paragraphs and lists readable', () => {
    const html =
      '<h2>Criterios</h2><p>Debe <strong>validar</strong> el rut.</p><ul><li><p>Primero</p></li><li>Segundo</li></ul>';

    expect(htmlToText(html, 500)).toBe(
      'Criterios\nDebe validar el rut.\n\n- Primero\n\n- Segundo',
    );
  });

  it('keeps the state of task list checkboxes', () => {
    const html =
      '<ul data-type="taskList"><li data-checked="true">Hecho</li><li data-checked="false">Pendiente</li></ul>';

    expect(htmlToText(html, 500)).toBe('- [x] Hecho\n- [ ] Pendiente');
  });

  it('drops scripts, styles, tags and images', () => {
    const html =
      '<style>p{color:red}</style><p>Hola<img src="x.png"/></p><script>alert(1)</script>';

    expect(htmlToText(html, 500)).toBe('Hola');
  });

  it('decodes entities once', () => {
    expect(htmlToText('<p>a &amp; b &lt;c&gt; &#233; &amp;lt;</p>', 500)).toBe(
      'a & b <c> é &lt;',
    );
  });

  it('turns line breaks into new lines', () => {
    expect(htmlToText('uno<br>dos<br/>tres', 500)).toBe('uno\ndos\ntres');
  });

  it('truncates long text and says so', () => {
    const text = htmlToText(`<p>${'a'.repeat(50)}</p>`, 10);

    expect(text).toBe(`${'a'.repeat(10)}\n…(recortado)`);
  });
});
