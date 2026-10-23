import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import { IconButton } from '@shared/ui/icon-button/icon-button';
import { MarkdownViewer } from '@shared/ui/markdown-viewer/markdown-viewer';
import { IconName } from '@shared/ui/icon/icons';
import { Spinner } from '@shared/ui/spinner/spinner';
import { ChatConversation } from '../chat-conversation';
import { ATTACHMENT_ACCEPT, AttachmentKind, formatBytes } from '../chat.models';

/** Alto máximo del cuadro de texto; pasado esto aparece su propio scroll. */
const MAX_INPUT_PX = 144;

/**
 * Chat flotante con la IA: un botón en la esquina abre el panel con la conversación y el cuadro para
 * escribir. El estado vive en la `ChatConversation` que se le pasa, de modo que otras partes de la
 * pantalla también pueden escribirle. Cada pantalla lo completa con sus propios elementos:
 * - `[chat-info]`: qué contexto tiene la IA (ej. el archivo abierto), bajo el encabezado.
 * - `[chat-empty]`: qué se puede hacer cuando la conversación está vacía.
 * - `[chat-actions]`: acciones junto al cuadro de texto (ej. «Replanificar»).
 *
 * También permite adjuntar archivos (PDF, imágenes, texto y CSV) con el clip, arrastrándolos al cuadro o
 * pegando una imagen.
 */
@Component({
  selector: 'app-chat-panel',
  imports: [Alert, Button, Icon, IconButton, MarkdownViewer, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.scss',
})
export class ChatPanel {
  readonly store = input.required<ChatConversation>();
  readonly heading = input.required<string>();
  /** Sobre qué se conversa, bajo el título (ej. `garage-labs/miobra-web #173`). */
  readonly context = input('');
  readonly placeholder = input('Escribe tu pregunta…');

  /** Lo escrito, solo para saber si el botón de enviar tiene algo que enviar. */
  protected readonly draft = signal('');
  /** Se están arrastrando archivos sobre el cuadro de texto. */
  protected readonly dragging = signal(false);

  protected readonly accept = ATTACHMENT_ACCEPT;
  protected readonly formatBytes = formatBytes;
  protected readonly kindIcon: Record<AttachmentKind, IconName> = {
    pdf: 'file-text',
    text: 'file-text',
    image: 'image',
  };

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // Al llegar un mensaje (o abrirse el panel) se baja hasta el final de la conversación.
    effect(() => {
      const chat = this.store();
      chat.messages();
      chat.sending();
      chat.open();
      setTimeout(() => {
        const element = this.scroller()?.nativeElement;
        if (element) element.scrollTop = element.scrollHeight;
      });
    });
  }

  protected onInput(box: HTMLTextAreaElement): void {
    this.draft.set(box.value);
    this.fit(box);
  }

  /** Lee el texto del cuadro y lo vacía ahí mismo, sin esperar a que se repinte la pantalla. */
  protected send(box: HTMLTextAreaElement): void {
    const text = box.value;
    const chat = this.store();
    // Con archivos todavía subiéndose no se envía: el texto se conserva en el cuadro.
    if (!chat.canSend(text)) return;
    box.value = '';
    this.draft.set('');
    this.fit(box);
    void chat.send(text);
  }

  /** Enter envía; Shift+Enter hace un salto de línea. No interfiere con la composición (IME). */
  protected onEnter(event: Event, box: HTMLTextAreaElement): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) return;
    key.preventDefault();
    this.send(box);
  }

  protected onPick(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    // Se vacía para que elegir el mismo archivo otra vez vuelva a disparar el cambio.
    input.value = '';
    if (files.length > 0) void this.store().attach(files);
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) void this.store().attach(files);
  }

  /** Pegar una captura de pantalla (u otro archivo) la adjunta; pegar texto sigue igual. */
  protected onPaste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    void this.store().attach(files);
  }

  /** El cuadro parte de una línea (como el botón de enviar) y crece con el texto hasta un tope. */
  private fit(box: HTMLTextAreaElement): void {
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, MAX_INPUT_PX)}px`;
  }
}
