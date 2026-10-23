import { extname } from 'node:path';
import { AttachmentKind } from './attachments';

export interface DetectedAttachment {
  kind: AttachmentKind;
  /** Extensión con la que se guarda (sin punto): la que corresponde al contenido, no la que dijo el usuario. */
  ext: string;
  mime: string;
}

/** Extensiones de archivos de texto que se aceptan, siempre que su contenido sea texto de verdad. */
const TEXT_TYPES: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  log: 'text/plain',
  xml: 'application/xml',
  yml: 'application/yaml',
  yaml: 'application/yaml',
};

const startsWith = (buffer: Buffer, bytes: number[]): boolean =>
  bytes.every((byte, index) => buffer[index] === byte);

/** Texto UTF-8 válido y sin bytes nulos (que delatan un binario con extensión de texto). */
function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.subarray(0, 8000).includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Qué es el archivo según su contenido: PDF e imágenes por sus primeros bytes (así un `.exe` renombrado a
 * `.pdf` no pasa), y texto por su extensión más una comprobación de que lo sea. `null` si no se acepta.
 */
export function detectAttachment(
  name: string,
  buffer: Buffer,
): DetectedAttachment | null {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { kind: 'pdf', ext: 'pdf', mime: 'application/pdf' };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'image', ext: 'png', mime: 'image/png' };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
  }
  const head = buffer.subarray(0, 12).toString('latin1');
  if (head.startsWith('GIF87a') || head.startsWith('GIF89a')) {
    return { kind: 'image', ext: 'gif', mime: 'image/gif' };
  }
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') {
    return { kind: 'image', ext: 'webp', mime: 'image/webp' };
  }

  const ext = extname(name).slice(1).toLowerCase();
  const mime = TEXT_TYPES[ext];
  if (mime && isUtf8Text(buffer)) return { kind: 'text', ext, mime };

  return null;
}
