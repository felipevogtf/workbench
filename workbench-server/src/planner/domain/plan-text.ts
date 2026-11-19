const HEADING = /^#{1,6}[ \t]+\S/;
/** La apertura de un bloque que envuelve todo el documento (no la de uno de código del plan, que lleva un lenguaje). */
const WRAPPER_OPEN = /^```(?:markdown|md)?[ \t]*$/i;

/** Desde la primera línea que cumple `starts`; sin ninguna, el texto tal cual. */
function from(text: string, starts: (line: string) => boolean): string {
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex(starts);
  return first > 0 ? lines.slice(first).join('\n').trim() : text;
}

/**
 * El plan tal como se guarda: sin lo que el modelo escribe antes de empezar («Ya tengo suficiente contexto, voy a escribir el plan») ni el
 * bloque de código con que a veces envuelve todo el documento. El plan siempre empieza en su primer encabezado.
 */
export function cleanPlan(markdown: string): string {
  // Charla antes del plan (o antes del bloque que lo envuelve).
  let text = from(
    markdown.trim(),
    (line) => HEADING.test(line) || WRAPPER_OPEN.test(line),
  );

  // Todo el plan dentro de un bloque ```markdown … ```: se saca del bloque.
  const fenced = /^```(?:markdown|md)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(
    text,
  );
  if (fenced) text = fenced[1].trim();

  return from(text, (line) => HEADING.test(line));
}
