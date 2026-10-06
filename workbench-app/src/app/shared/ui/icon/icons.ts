export interface IconDef {
  viewBox: string;
  /** `fill`: relleno sólido. `stroke`: trazo de 2px, sin relleno. */
  kind: 'fill' | 'stroke';
  paths: readonly string[];
}

// Los de relleno (arrow-outward, github) y menu/code salen de minimalist-portfolio/src/icons.
// El logo usa el escudo del portfolio con una W (Workbench) en lugar de la F.
// Los de trazo restantes siguen el mismo estilo (24x24, trazo 2, extremos redondeados).
export const ICONS = {
  'arrow-outward': {
    viewBox: '0 0 24 24',
    kind: 'fill',
    paths: [
      'm16 8.4l-8.9 8.9q-.275.275-.7.275t-.7-.275t-.275-.7t.275-.7L14.6 7H7q-.425 0-.712-.288T6 6t.288-.712T7 5h10q.425 0 .713.288T18 6v10q0 .425-.288.713T17 17t-.712-.288T16 16z',
    ],
  },
  github: {
    viewBox: '0 0 24 24',
    kind: 'fill',
    paths: [
      'M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2',
    ],
  },
  logo: {
    viewBox: '0 0 80 100',
    kind: 'fill',
    paths: [
      'M40 18.575 80 0v77.095L40.289 100 0 77.095V0l40 18.575ZM12.2 32 27.3 72.8 40 54 52.7 72.8 67.8 32H58.2L50.3 53.2 40 38 29.7 53.2 21.8 32Z',
    ],
  },
  menu: { viewBox: '0 0 24 24', kind: 'stroke', paths: ['M4 12h16M4 6h16M4 18h16'] },
  code: { viewBox: '0 0 24 24', kind: 'stroke', paths: ['m16 18l6-6l-6-6M8 6l-6 6l6 6'] },
  bitbucket: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['M3 4h18l-2.2 15.4a1 1 0 0 1-1 .6H6.2a1 1 0 0 1-1-.6L3 4z', 'M8.5 14h7'],
  },
  check: { viewBox: '0 0 24 24', kind: 'stroke', paths: ['M20 6 9 17l-5-5'] },
  x: { viewBox: '0 0 24 24', kind: 'stroke', paths: ['M18 6 6 18M6 6l12 12'] },
  plus: { viewBox: '0 0 24 24', kind: 'stroke', paths: ['M5 12h14M12 5v14'] },
  refresh: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
      'M21 3v5h-5',
      'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
      'M8 16H3v5',
    ],
  },
  trash: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M3 6h18',
      'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6',
      'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
    ],
  },
  edit: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'],
  },
  play: { viewBox: '0 0 24 24', kind: 'stroke', paths: ['M5 3l14 9-14 9V3z'] },
  'chevron-down': { viewBox: '0 0 24 24', kind: 'stroke', paths: ['m6 9 6 6 6-6'] },
  'chevron-right': { viewBox: '0 0 24 24', kind: 'stroke', paths: ['m9 18 6-6-6-6'] },
  'arrow-left': { viewBox: '0 0 24 24', kind: 'stroke', paths: ['m12 19-7-7 7-7', 'M19 12H5'] },
  'git-pull-request': {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M18 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
      'M6 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
      'M13 6h3a2 2 0 0 1 2 2v7',
      'M6 9v12',
    ],
  },
  bot: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M12 8V4H8',
      'M4 8h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
      'M2 14h2',
      'M20 14h2',
      'M15 13v2',
      'M9 13v2',
    ],
  },
  copy: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z',
      'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
    ],
  },
  download: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  },
  alert: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
      'M12 9v4',
      'M12 17h.01',
    ],
  },
  info: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'M12 16v-4', 'M12 8h.01'],
  },
  clock: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'M12 6v6l4 2'],
  },
  inbox: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M22 12h-6l-2 3h-4l-2-3H2',
      'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    ],
  },
  more: { viewBox: '0 0 24 24', kind: 'stroke', paths: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'] },
  'arrow-up': { viewBox: '0 0 24 24', kind: 'stroke', paths: ['m5 12 7-7 7 7', 'M12 19V5'] },
  'arrow-down': { viewBox: '0 0 24 24', kind: 'stroke', paths: ['M12 5v14', 'm19 12-7 7-7-7'] },
  search: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['m21 21-4.34-4.34', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z'],
  },
  'list-checks': {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['m3 17 2 2 4-4', 'm3 7 2 2 4-4', 'M13 6h8', 'M13 12h8', 'M13 18h8'],
  },
  kanban: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
      'M8 7v7',
      'M12 7v4',
      'M16 7v9',
    ],
  },
  folder: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
    ],
  },
  tag: {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: [
      'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z',
      'M7.5 7.5h.01',
    ],
  },
  'circle-dot': {
    viewBox: '0 0 24 24',
    kind: 'stroke',
    paths: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
