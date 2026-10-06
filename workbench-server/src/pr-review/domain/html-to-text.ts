const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  amp: '&',
};

/**
 * Convierte el HTML de un ticket de Plane en texto plano para el agente: conserva listas y casillas
 * (`- [ ]`, `- [x]`) y descarta etiquetas, estilos e imágenes. Recorta a `maxLength` caracteres.
 */
export function htmlToText(
  html: string | null | undefined,
  maxLength: number,
): string {
  if (!html) return '';

  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<li[^>]*data-checked="true"[^>]*>/gi, '\n- [x] ')
    .replace(/<li[^>]*data-checked="false"[^>]*>/gi, '\n- [ ] ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    // `&amp;` al final, para no decodificar dos veces (`&amp;lt;` → `&lt;`).
    .replace(
      /&(nbsp|lt|gt|quot|apos|amp);/g,
      (_, name: string) => NAMED_ENTITIES[name],
    )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.length > maxLength
    ? `${text.slice(0, maxLength).trimEnd()}\n…(recortado)`
    : text;
}
