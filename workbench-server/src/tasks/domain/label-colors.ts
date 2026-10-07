/** Colores que se asignan a las etiquetas nuevas que no traen uno (la misma paleta del selector del front). */
export const LABEL_COLORS: readonly string[] = [
  '#9ca3af',
  '#64748b',
  '#3b82f6',
  '#0ea5e9',
  '#06b6d4',
  '#14b8a6',
  '#06d6a0',
  '#84cc16',
  '#ffc43d',
  '#f97316',
  '#ef4444',
  '#ef476f',
  '#ec4899',
  '#a855f7',
  '#6366f1',
  '#8b5e3c',
];

export function randomLabelColor(random: () => number = Math.random): string {
  return LABEL_COLORS[Math.floor(random() * LABEL_COLORS.length)];
}
