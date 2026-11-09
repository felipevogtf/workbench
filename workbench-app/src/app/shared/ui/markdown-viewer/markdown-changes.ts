import { Marked, Renderer, marked, type Token } from 'marked';

/** La clase que llevan los trozos que cambiaron respecto a la versión anterior. */
export const CHANGED_CLASS = 'md-changed';

/** El texto original de cada trozo (título, párrafo, ítem de lista, bloque de código…) de un Markdown, anidados incluidos. */
function rawsOf(content: string): Set<string> {
  const raws = new Set<string>();
  const walk = (tokens: readonly Token[]) => {
    for (const token of tokens) {
      const raw = token.raw.trim();
      if (raw) raws.add(raw);
      const nested = token as { items?: Token[]; tokens?: Token[] };
      if (nested.items) walk(nested.items);
      if (nested.tokens) walk(nested.tokens);
    }
  };
  walk(new Marked().lexer(content));
  return raws;
}

/**
 * Renderiza Markdown. Con `previous`, los títulos, párrafos, ítems de lista, bloques de código y tablas que no estaban tal cual en
 * esa versión anterior salen marcados con la clase `md-changed`, para ver de un vistazo qué tocó una edición. Sin `previous` es el
 * Markdown de siempre.
 */
export function renderMarkdown(
  content: string,
  options: { breaks: boolean; previous?: string | null },
): string {
  const { breaks, previous } = options;
  if (previous == null) {
    return marked.parse(content, { async: false, gfm: true, breaks });
  }

  const known = rawsOf(previous);
  const base = new Renderer();
  const isNew = (token: { raw: string }) => !known.has(token.raw.trim());
  const wrap = (html: string, token: { raw: string }) =>
    isNew(token) ? `<div class="${CHANGED_CLASS}">${html}</div>` : html;

  const instance = new Marked({ gfm: true, breaks });
  instance.use({
    renderer: {
      paragraph(token) {
        return wrap(base.paragraph.call(this, token), token);
      },
      heading(token) {
        return wrap(base.heading.call(this, token), token);
      },
      code(token) {
        return wrap(base.code.call(this, token), token);
      },
      table(token) {
        return wrap(base.table.call(this, token), token);
      },
      listitem(token) {
        const html = base.listitem.call(this, token);
        return isNew(token) ? html.replace(/^<li/, `<li class="${CHANGED_CLASS}"`) : html;
      },
    },
  });
  return instance.parse(content, { async: false });
}
