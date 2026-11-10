import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import { renderMarkdown } from './markdown-changes';

/**
 * Renderiza Markdown. El HTML resultante se enlaza con `[innerHTML]`, así que pasa por el sanitizador
 * de Angular (descarta scripts y atributos peligrosos). Nunca se marca como confiable: el texto lo
 * escribe un modelo leyendo código y descripciones ajenos.
 */
@Component({
  selector: 'app-markdown-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div class="markdown" [class.markdown--document]="document()" [innerHTML]="html()"></div>`,
  styleUrl: './markdown-viewer.scss',
})
export class MarkdownViewer {
  readonly content = input.required<string>();
  /** Respeta los saltos de línea simples (lo que escribe una persona); por defecto se juntan, como en Markdown. */
  readonly breaks = input(false);
  /** Para leer un documento largo (un plan): títulos de sección marcados, más aire y un ancho de línea cómodo. */
  readonly document = input(false);
  /** La versión anterior del texto: lo que cambió respecto a ella sale resaltado. Sin ella no se resalta nada. */
  readonly previous = input<string | null>(null);

  protected readonly html = computed(() => {
    const rendered = renderMarkdown(this.content(), {
      breaks: this.breaks(),
      previous: this.previous(),
    });
    // Los enlaces del contenido siempre abren aparte y sin acceso a la ventana de origen.
    return rendered.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  });
}
