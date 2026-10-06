import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import { marked } from 'marked';

/**
 * Renderiza Markdown. El HTML resultante se enlaza con `[innerHTML]`, así que pasa por el sanitizador
 * de Angular (descarta scripts y atributos peligrosos). Nunca se marca como confiable: el texto lo
 * escribe un modelo leyendo código y descripciones ajenos.
 */
@Component({
  selector: 'app-markdown-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div class="markdown" [innerHTML]="html()"></div>`,
  styleUrl: './markdown-viewer.scss',
})
export class MarkdownViewer {
  readonly content = input.required<string>();

  protected readonly html = computed(() => {
    const rendered = marked.parse(this.content(), { async: false, gfm: true });
    // Los enlaces del contenido siempre abren aparte y sin acceso a la ventana de origen.
    return rendered.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  });
}
