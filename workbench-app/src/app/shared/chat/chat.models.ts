/** Qué tipo de archivo es un adjunto (PDF e imágenes los lee la IA tal cual; `text` incluye CSV y similares). */
export type AttachmentKind = 'pdf' | 'image' | 'text';

/** Un archivo adjunto a un mensaje, ya subido al servidor. */
export interface ChatAttachment {
  /** Con este id lo referencia el mensaje. */
  id: string;
  name: string;
  kind: AttachmentKind;
  size: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatAttachment[];
}

/** Un adjunto que se está preparando para el próximo mensaje. */
export interface DraftAttachment {
  /** Identifica el borrador mientras se sube (todavía no hay id del servidor). */
  key: string;
  name: string;
  size: number;
  status: 'uploading' | 'ready' | 'error';
  /** Cuando está listo, el adjunto subido. */
  attachment?: ChatAttachment;
  /** Cuando falló, por qué. */
  error?: string;
}

/** Largo máximo de un mensaje que acepta el servidor; lo que pase de ahí se recorta al enviarlo. */
export const MAX_MESSAGE_CHARS = 30_000;

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Lo que se manda como texto cuando el mensaje solo trae archivos. */
export const ATTACHMENTS_ONLY_TEXT = 'Te adjunto estos archivos.';

const EXTENSION_KIND: Record<string, AttachmentKind> = {
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  txt: 'text',
  md: 'text',
  markdown: 'text',
  csv: 'text',
  tsv: 'text',
  json: 'text',
  log: 'text',
  xml: 'text',
  yml: 'text',
  yaml: 'text',
};

/** Para el selector de archivos: los tipos que se pueden adjuntar. */
export const ATTACHMENT_ACCEPT = Object.keys(EXTENSION_KIND)
  .map((extension) => `.${extension}`)
  .join(',');

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Por qué un archivo no se puede adjuntar, o null si se puede. El servidor vuelve a comprobarlo mirando el
 * contenido; esto evita subir lo que de todos modos va a rechazar.
 */
export function attachmentProblem(file: Pick<File, 'name' | 'size'>): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!file.name.includes('.') || !(extension in EXTENSION_KIND)) {
    return 'Solo se pueden adjuntar PDF, imágenes (PNG, JPG, GIF, WebP) y archivos de texto o CSV.';
  }
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `Pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(MAX_ATTACHMENT_BYTES)}.`;
  }
  return null;
}
