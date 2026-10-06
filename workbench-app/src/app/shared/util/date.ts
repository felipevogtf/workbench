/** Hoy en la zona horaria local, como `YYYY-MM-DD` (`toISOString` daría el día en UTC). */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `2026-10-06` → `6 oct 2026`. Sin fecha (o inválida) devuelve `—`. */
export function formatDay(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return '—';

  // Se arma con partes locales: `new Date('2026-10-06')` se interpretaría en UTC y podría mostrar el día anterior.
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** `1.5` → `1,5 h`. */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  return `${hours.toLocaleString('es-CL', { maximumFractionDigits: 2 })} h`;
}
