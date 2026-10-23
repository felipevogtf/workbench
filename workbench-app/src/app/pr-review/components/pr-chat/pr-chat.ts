import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { Spinner } from '@shared/ui/spinner/spinner';
import { PullRequestChatStore } from '../../data-access/pull-request-chat.store';

/**
 * Chat flotante para preguntarle a la IA sobre la PR (el agente lee el repo de la PR). Un botón en la
 * esquina abre el panel; el estado y la conversación viven en `PullRequestChatStore`, de modo que otras
 * partes de la pantalla (como el botón de IA de cada segmento del diff) también pueden escribirle.
 */
@Component({
  selector: 'app-pr-chat',
  imports: [Alert, Button, Icon, IconButton, MarkdownViewer, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pr-chat.html',
  styleUrl: './pr-chat.scss',
})
export class PrChat {
  /** Qué PR es, para el encabezado (ej. `garage-labs/miobra-web #173`). */
  readonly context = input.required<string>();

  protected readonly store = inject(PullRequestChatStore);
  /** Lo escrito, solo para saber si el botón de enviar tiene algo que enviar. */
  protected readonly draft = signal('');

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // Al llegar un mensaje (o abrirse el panel) se baja hasta el final de la conversación.
    effect(() => {
      this.store.messages();
      this.store.sending();
      this.store.open();
      setTimeout(() => {
        const element = this.scroller()?.nativeElement;
        if (element) element.scrollTop = element.scrollHeight;
      });
    });
  }

  /** Lee el texto del cuadro y lo vacía ahí mismo, sin esperar a que se repinte la pantalla. */
  protected send(box: HTMLTextAreaElement): void {
    const text = box.value;
    if (!text.trim() || this.store.sending()) return;
    box.value = '';
    this.draft.set('');
    void this.store.send(text);
  }

  /** Enter envía; Shift+Enter hace un salto de línea. No interfiere con la composición (IME). */
  protected onEnter(event: Event, box: HTMLTextAreaElement): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    key.preventDefault();
    this.send(box);
  }
}
