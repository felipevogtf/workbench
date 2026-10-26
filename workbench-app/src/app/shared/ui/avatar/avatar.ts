import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Colores neón de los personajes conocidos; el resto toma uno de la lista según su nombre. */
const KNOWN: Record<string, string> = {
  lucy: '#22d3ee',
  david: '#facc15',
  maine: '#f87171',
  rebecca: '#f472b6',
  kiwi: '#4ade80',
  pilar: '#a78bfa',
  faraday: '#fb923c',
  doc: '#60a5fa',
  falco: '#fbbf24',
  gloria: '#c084fc',
  dorio: '#fb7185',
};
const PALETTE = ['#22d3ee', '#facc15', '#f87171', '#f472b6', '#4ade80', '#a78bfa', '#fb923c'];

/** El color de un nombre: el del personaje si es conocido y, si no, uno estable según sus letras. */
export function avatarColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (KNOWN[key]) return KNOWN[key];

  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/**
 * Avatar redondo de una persona o un agente: su imagen si la tiene y, si no, una insignia neón con
 * la inicial. El nombre ya se muestra al lado, así que la imagen es solo decorativa.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--avatar-color]': 'color()',
    '[style.width]': 'size()',
    '[style.height]': 'size()',
    '[style.font-size]': 'fontSize()',
    '[attr.data-image]': 'src() ? "" : null',
  },
  template: `
    @if (src(); as image) {
      <img [src]="image" alt="" />
    } @else {
      <span aria-hidden="true">{{ initial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      flex: none;
      place-items: center;
      overflow: hidden;
      border: 2px solid var(--avatar-color);
      border-radius: 50%;
      background: #14141c;
      box-shadow: 0 0 8px color-mix(in srgb, var(--avatar-color) 55%, transparent);
      font-weight: 700;
      line-height: 1;
      color: var(--avatar-color);
    }

    /* Con foto no hay marco: el neón es solo de la insignia con inicial. */
    :host([data-image]) {
      border: 0;
      box-shadow: none;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  /** Imagen (URL o data URL); sin ella se dibuja la inicial. */
  readonly src = input<string | null | undefined>(null);
  readonly size = input('2rem');

  protected readonly color = computed(() => avatarColor(this.name()));
  protected readonly initial = computed(() => this.name().trim().charAt(0).toUpperCase() || '?');
  protected readonly fontSize = computed(() => `calc(${this.size()} * 0.45)`);
}
